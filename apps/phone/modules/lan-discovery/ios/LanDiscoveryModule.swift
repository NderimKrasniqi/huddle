import ExpoModulesCore
import Network

/**
 * TASK-04 spike: finds a Huddle TV on the local network by its room code. The
 * TV advertises `Huddle-<code>` as `_huddle._tcp` with a `code` TXT entry; a
 * short TCP connection to the match yields an IPv4 host and port the phone's
 * WebSocket can use.
 */
public class LanDiscoveryModule: Module {
  private let queue = DispatchQueue(label: "tv.huddle.landiscovery")

  public func definition() -> ModuleDefinition {
    Name("LanDiscovery")

    AsyncFunction("find") { (code: String, timeoutMs: Int, promise: Promise) in
      self.queue.async { self.find(code: code.uppercased(), timeoutMs: timeoutMs, promise: promise) }
    }
  }

  private func find(code: String, timeoutMs: Int, promise: Promise) {
    let browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_huddle._tcp", domain: nil), using: .tcp)
    var settled = false
    var resolver: NWConnection?
    var seen: [String] = []
    var resolverState = "none"
    var browserState = "setup"

    func finish(_ value: [String: Any]?) {
      guard !settled else { return }
      settled = true
      browser.cancel()
      resolver?.cancel()
      promise.resolve(value)
    }

    browser.stateUpdateHandler = { state in
      browserState = "\(state)"
      switch state {
      case .waiting(let error), .failed(let error):
        guard !settled else { return }
        // The player turned off Local Network access for Huddle.
        if case .dns(let code) = error, code == DNSServiceErrorType(kDNSServiceErr_PolicyDenied) {
          settled = true
          browser.cancel()
          promise.reject("E_LOCAL_NETWORK_DENIED", "Local Network access is off for Huddle")
          return
        }
        if case .failed = state {
          settled = true
          browser.cancel()
          promise.reject("E_BROWSE", "\(error)")
        }
      default:
        break
      }
    }
    browser.browseResultsChangedHandler = { results, _ in
      guard resolver == nil else { return }
      for result in results {
        guard case .service(let name, _, _, _) = result.endpoint else { continue }
        seen.append(name)
        var advertisedCode: String?
        var txtHosts: [String] = []
        var txtPort: Int?
        if case .bonjour(let txt) = result.metadata {
          advertisedCode = txt["code"]
          txtHosts = (txt["hosts"] ?? "").split(separator: ",").map(String.init)
          txtPort = txt["port"].flatMap { Int($0) }
        }
        guard name == "Huddle-\(code)" || advertisedCode == code else { continue }
        // The TV publishes its IPv4 addresses: a resolved Bonjour endpoint is
        // often IPv6 link-local, whose interface zone a WebSocket URL cannot carry.
        if let txtPort, !txtHosts.isEmpty {
          finish(["hosts": txtHosts, "port": txtPort, "name": name])
          return
        }

        let connection = NWConnection(to: result.endpoint, using: .tcp)
        resolver = connection
        connection.stateUpdateHandler = { state in
          resolverState = "\(state)"
          switch state {
          case .ready:
            if case .hostPort(let host, let port) = connection.currentPath?.remoteEndpoint {
              var address: String
              switch host {
              case .ipv4(let v4): address = "\(v4)"
              case .ipv6(let v6): address = "[\(v6)]"
              default: address = "\(host)"
              }
              if let scope = address.firstIndex(of: "%") { address = String(address[..<scope]) + (address.hasPrefix("[") ? "]" : "") }
              finish(["hosts": [address], "port": Int(port.rawValue), "name": name])
            } else {
              finish(nil)
            }
          case .failed:
            finish(nil)
          default:
            break
          }
        }
        connection.start(queue: self.queue)
        return
      }
    }
    browser.start(queue: queue)
    queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
      // Spike diagnostics: what the browser saw and where resolving stopped.
      if seen.isEmpty { finish(nil) } else {
        finish(["hosts": [], "port": 0, "name": "timeout", "seen": seen, "resolver": resolverState, "browser": browserState])
      }
    }
  }
}
