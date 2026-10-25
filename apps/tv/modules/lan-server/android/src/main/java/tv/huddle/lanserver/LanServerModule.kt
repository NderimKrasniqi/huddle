package tv.huddle.lanserver

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo

/**
 * TASK-02 spike: a WebSocket server inside the TV app.
 *
 * Every connection gets a small integer id. Text frames go to JavaScript as
 * events, and JavaScript answers through `send`, so a round trip measured from
 * a phone includes the bridge the room host will sit behind.
 */
class LanServerModule : Module() {
  private var server: WebSocketServer? = null
  private val sockets = ConcurrentHashMap<Int, WebSocket>()
  private val nextId = AtomicInteger(1)

  private fun emit(name: String, body: Map<String, Any?>) = sendEvent(name, body)

  private var registration: NsdManager.RegistrationListener? = null

  private fun nsd(): NsdManager? =
    appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager

  private fun stopAdvertising() {
    val listener = registration ?: return
    registration = null
    runCatching { nsd()?.unregisterService(listener) }
  }

  override fun definition() = ModuleDefinition {
    Name("LanServer")

    Events("onOpen", "onMessage", "onClose", "onError")

    AsyncFunction("start") { port: Int, promise: Promise ->
      if (server != null) {
        promise.resolve(port)
        return@AsyncFunction
      }
      val created = object : WebSocketServer(InetSocketAddress(port)) {
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

        override fun onError(conn: WebSocket?, ex: Exception) {
          emit("onError", mapOf("id" to conn?.getAttachment<Int?>(), "message" to ex.toString()))
        }

        override fun onStart() {
          promise.resolve(port)
        }
      }
      created.isReuseAddr = true
      created.isTcpNoDelay = true
      created.connectionLostTimeout = 10
      server = created
      created.start()
    }

    Function("send") { id: Int, data: String ->
      sockets[id]?.takeIf { it.isOpen }?.send(data)
    }

    Function("close") { id: Int ->
      sockets[id]?.close()
    }

    AsyncFunction("stop") {
      server?.stop(1000)
      server = null
      sockets.clear()
    }

    // TASK-04 spike: announce the room on the local network as `Huddle-<code>`.
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
        setAttribute(
          "hosts",
          NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .flatMap { it.inetAddresses.toList() }
            .filterIsInstance<Inet4Address>()
            .mapNotNull { it.hostAddress }
            .joinToString(","),
        )
      }
      val listener = object : NsdManager.RegistrationListener {
        override fun onServiceRegistered(registered: NsdServiceInfo) {
          promise.resolve(registered.serviceName)
        }
        override fun onRegistrationFailed(failed: NsdServiceInfo, errorCode: Int) {
          promise.reject("E_NSD", "registration failed: $errorCode", null)
        }
        override fun onServiceUnregistered(unregistered: NsdServiceInfo) {}
        override fun onUnregistrationFailed(failed: NsdServiceInfo, errorCode: Int) {}
      }
      registration = listener
      manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    Function("stopAdvertising") { stopAdvertising() }

    Function("addresses") {
      NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>()
        .map { it.hostAddress ?: "" }
        .filter { it.isNotEmpty() }
    }

    OnDestroy {
      stopAdvertising()
      server?.stop(0)
      server = null
    }
  }
}
