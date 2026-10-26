package tv.huddle.lanserver

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.java_websocket.WebSocket
import org.java_websocket.drafts.Draft_6455
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

private const val MAX_FRAME_BYTES = 256 * 1024

private const val CONNECTION_LOST_SECONDS = 10

class LanServerModule : Module() {
  private var server: WebSocketServer? = null
  private val sockets = ConcurrentHashMap<Int, WebSocket>()
  private val nextId = AtomicInteger(1)
  private var registration: NsdManager.RegistrationListener? = null

  override fun definition() = ModuleDefinition {
    Name("LanServer")

    Events("onOpen", "onMessage", "onClose", "onError")

    AsyncFunction("start") { port: Int, promise: Promise ->
      val running = server
      if (running != null) {
        promise.resolve(running.port)
        return@AsyncFunction
      }
      listen(port, fallBack = true, promise)
    }

    Function("send") { id: Int, data: String ->
      sockets[id]?.takeIf { it.isOpen }?.send(data)
    }

    Function("close") { id: Int ->
      sockets[id]?.close()
    }

    AsyncFunction("stop") {
      stopAll()
    }

    Function("addresses") {
      ipv4Addresses()
    }

    AsyncFunction("advertise") { code: String, port: Int, promise: Promise ->
      val manager = nsd()
      if (manager == null) {
        promise.reject("E_NSD", "NsdManager unavailable", null)
        return@AsyncFunction
      }
      stopAdvertising()
      val info = NsdServiceInfo().apply {
        serviceName = "Huddle-$code"
        serviceType = "_huddle._tcp"
        setPort(port)
        setAttribute("code", code)
        setAttribute("port", port.toString())
        setAttribute("hosts", ipv4Addresses().joinToString(","))
      }
      val settled = AtomicBoolean(false)
      val listener = object : NsdManager.RegistrationListener {
        override fun onServiceRegistered(registered: NsdServiceInfo) {
          if (settled.compareAndSet(false, true)) promise.resolve(registered.serviceName)
        }
        override fun onRegistrationFailed(failed: NsdServiceInfo, errorCode: Int) {
          if (settled.compareAndSet(false, true)) promise.reject("E_NSD", "registration failed: $errorCode", null)
        }
        override fun onServiceUnregistered(unregistered: NsdServiceInfo) {}
        override fun onUnregistrationFailed(failed: NsdServiceInfo, errorCode: Int) {}
      }
      registration = listener
      manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    Function("stopAdvertising") { stopAdvertising() }

    OnDestroy { stopAll() }
  }

  private fun listen(port: Int, fallBack: Boolean, promise: Promise) {
    val started = AtomicBoolean(false)
    val created = object : WebSocketServer(InetSocketAddress(port), listOf(Draft_6455(emptyList(), MAX_FRAME_BYTES))) {
      override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        val id = nextId.getAndIncrement()
        conn.setAttachment(id)
        sockets[id] = conn
        emit("onOpen", mapOf("id" to id, "remote" to conn.remoteSocketAddress?.toString()))
      }

      override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        val id = conn.getAttachment<Int?>() ?: return
        sockets.remove(id)
        emit("onClose", mapOf("id" to id, "code" to code, "reason" to reason))
      }

      override fun onMessage(conn: WebSocket, message: String) {
        val id = conn.getAttachment<Int?>() ?: return
        emit("onMessage", mapOf("id" to id, "data" to message))
      }

      override fun onMessage(conn: WebSocket, message: ByteBuffer) {
        conn.close(1003, "text frames only")
      }

      override fun onError(conn: WebSocket?, ex: Exception) {
        if (conn == null && started.compareAndSet(false, true)) {
          server = null
          if (fallBack && port != 0) listen(0, fallBack = false, promise) else promise.reject("E_LISTEN", ex.toString(), ex)
          return
        }
        emit("onError", mapOf("id" to conn?.getAttachment<Int?>(), "message" to ex.toString()))
      }

      override fun onStart() {
        if (started.compareAndSet(false, true)) promise.resolve(this.port)
      }
    }
    created.isReuseAddr = true
    created.isTcpNoDelay = true
    created.connectionLostTimeout = CONNECTION_LOST_SECONDS
    server = created
    created.start()
  }

  private fun emit(name: String, body: Map<String, Any?>) = sendEvent(name, body)

  private fun nsd(): NsdManager? =
    appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager

  private fun stopAdvertising() {
    val listener = registration ?: return
    registration = null
    runCatching { nsd()?.unregisterService(listener) }
  }

  private fun stopAll() {
    stopAdvertising()
    runCatching { server?.stop(1000) }
    server = null
    sockets.clear()
  }
}

private fun ipv4Addresses(): List<String> =
  NetworkInterface.getNetworkInterfaces().toList()
    .filter { it.isUp && !it.isLoopback }
    .flatMap { it.inetAddresses.toList() }
    .filterIsInstance<Inet4Address>()
    .mapNotNull { it.hostAddress }
    .sortedBy { addressRank(it) }

private fun addressRank(address: String): Int = when {
  address.startsWith("192.168.") -> 0
  address.startsWith("10.") -> 1
  Regex("^172\\.(1[6-9]|2\\d|3[01])\\.").containsMatchIn(address) -> 2
  else -> 3
}
