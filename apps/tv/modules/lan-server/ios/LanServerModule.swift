import ExpoModulesCore
import Network

/** Largest text frame the TV accepts; matches the Room Protocol's limit. */
private let maxFrameBytes = 256 * 1024

/**
 * The TV's LAN WebSocket server on Apple TV (ADR-02), on Network.framework.
 *
 * Same API as the Android module: each phone connection gets a small integer
 * id, text frames reach JavaScript as `onMessage` events, and JavaScript
 * answers with `send`. Binary frames are refused by closing the connection.
 * tvOS suspends a backgrounded app within seconds, so the shell stops and
 * restarts this server around background and foreground.
 */
public class LanServerModule: Module {
  private let queue = DispatchQueue(label: "tv.huddle.lanserver")
  private var listener: NWListener?
  private var connections: [Int: NWConnection] = [:]
  private var nextId = 1

  public func definition() -> ModuleDefinition {
    Name("LanServer")

    Events("onOpen", "onMessage", "onClose", "onError")

    /** Listens on `port`, or on any free port when that one is taken; resolves the port in use. */
    AsyncFunction("start") { (port: Int, promise: Promise) in
      self.queue.async {
        if let running = self.listener, let current = running.port {
          promise.resolve(Int(current.rawValue))
          return
        }
        self.listen(port: port, fallBack: true, promise: promise)
      }
    }

    Function("send") { (id: Int, data: String) in
      self.queue.async {
        guard let connection = self.connections[id] else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "text", metadata: [metadata])
        connection.send(content: data.data(using: .utf8), contentContext: context, isComplete: true, completion: .idempotent)
      }
    }

    Function("close") { (id: Int) in
      self.queue.async { self.connections[id]?.cancel() }
    }

    AsyncFunction("stop") { (promise: Promise) in
      self.queue.async {
        self.stopAll()
        promise.resolve(nil)
      }
    }

    /** IPv4 addresses, home-network ranges first, so a QR code can carry the likeliest one. */
    Function("addresses") { () -> [String] in
      LanServerModule.ipv4Addresses()
    }

    /** Announces the room as `Huddle-<code>` (`_huddle._tcp`) with code, port and hosts in TXT. */
    AsyncFunction("advertise") { (code: String, port: Int, promise: Promise) in
      self.queue.async {
        guard let listener = self.listener else {
          promise.reject("E_NOT_LISTENING", "Start the server before advertising")
          return
        }
        let hosts = LanServerModule.ipv4Addresses().joined(separator: ",")
        let txt = NWTXTRecord(["code": code, "port": "\(port)", "hosts": hosts])
        listener.service = NWListener.Service(name: "Huddle-\(code)", type: "_huddle._tcp", domain: nil, txtRecord: txt)
        promise.resolve("Huddle-\(code)")
      }
    }

    Function("stopAdvertising") {
      self.queue.async { self.listener?.service = nil }
    }

    OnDestroy {
      self.queue.sync { self.stopAll() }
    }
  }

  private func listen(port: Int, fallBack: Bool, promise: Promise) {
    let parameters = NWParameters.tcp
    let webSocket = NWProtocolWebSocket.Options()
    webSocket.autoReplyPing = true
    webSocket.maximumMessageSize = maxFrameBytes
    parameters.defaultProtocolStack.applicationProtocols.insert(webSocket, at: 0)
    parameters.allowLocalEndpointReuse = true
    if let tcp = parameters.defaultProtocolStack.transportProtocol as? NWProtocolTCP.Options {
      tcp.noDelay = true
    }
    let requested = port == 0 ? NWEndpoint.Port.any : NWEndpoint.Port(rawValue: UInt16(clamping: port)) ?? .any
    let created: NWListener
    do {
      created = try NWListener(using: parameters, on: requested)
    } catch {
      promise.reject("E_LISTEN", error.localizedDescription)
      return
    }
    var settled = false
    created.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        if !settled {
          settled = true
          promise.resolve(Int(created.port?.rawValue ?? 0))
        }
      case .failed(let error):
        created.cancel()
        if self.listener === created { self.listener = nil }
        if !settled {
          settled = true
          // The port is taken: listen anywhere instead.
          if fallBack && port != 0 { self.listen(port: 0, fallBack: false, promise: promise) } else { promise.reject("E_LISTEN", error.localizedDescription) }
          return
        }
        self.sendEvent("onError", ["message": error.localizedDescription])
      default:
        break
      }
    }
    created.newConnectionHandler = { [weak self] connection in
      self?.accept(connection)
    }
    listener = created
    created.start(queue: queue)
  }

  private func accept(_ connection: NWConnection) {
    let id = nextId
    nextId += 1
    connections[id] = connection
    connection.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        self.sendEvent("onOpen", ["id": id, "remote": "\(connection.endpoint)"])
        self.receive(id: id, connection: connection)
      case .failed(let error):
        self.drop(id: id, code: 1006, reason: error.localizedDescription)
      case .cancelled:
        self.drop(id: id, code: 1000, reason: "")
      default:
        break
      }
    }
    connection.start(queue: queue)
  }

  private func receive(id: Int, connection: NWConnection) {
    connection.receiveMessage { [weak self] data, context, _, error in
      guard let self else { return }
      if let error {
        self.drop(id: id, code: 1006, reason: error.localizedDescription)
        connection.cancel()
        return
      }
      let metadata = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata
      switch metadata?.opcode {
      case .close?, .binary?:
        connection.cancel()
        return
      case .text?:
        if let data, let text = String(data: data, encoding: .utf8) {
          self.sendEvent("onMessage", ["id": id, "data": text])
        }
      default:
        break
      }
      self.receive(id: id, connection: connection)
    }
  }

  private func drop(id: Int, code: Int, reason: String) {
    guard connections.removeValue(forKey: id) != nil else { return }
    sendEvent("onClose", ["id": id, "code": code, "reason": reason])
  }

  private func stopAll() {
    listener?.service = nil
    listener?.cancel()
    listener = nil
    for connection in connections.values { connection.cancel() }
    connections.removeAll()
  }

  /** Non-loopback IPv4 addresses, private home-network ranges first and VPN-style ranges last. */
  private static func ipv4Addresses() -> [String] {
    var result: [String] = []
    var pointer: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&pointer) == 0, let first = pointer else { return result }
    defer { freeifaddrs(pointer) }
    for entry in sequence(first: first, next: { $0.pointee.ifa_next }) {
      let flags = Int32(entry.pointee.ifa_flags)
      guard let address = entry.pointee.ifa_addr, address.pointee.sa_family == UInt8(AF_INET),
            flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0 else { continue }
      var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      if getnameinfo(address, socklen_t(address.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
        result.append(String(cString: host))
      }
    }
    return result.sorted { rank($0) < rank($1) }
  }

  private static func rank(_ address: String) -> Int {
    if address.hasPrefix("192.168.") { return 0 }
    if address.hasPrefix("10.") { return 1 }
    let parts = address.split(separator: ".").compactMap { Int($0) }
    if parts.count == 4, parts[0] == 172, (16...31).contains(parts[1]) { return 2 }
    return 3
  }
}
