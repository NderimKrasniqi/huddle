package tv.huddle.landiscovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

class LanDiscoveryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LanDiscovery")

    AsyncFunction("find") { code: String, timeoutMs: Int, promise: Promise ->
      val manager = appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager
      if (manager == null) {
        promise.reject("E_NSD", "NsdManager unavailable", null)
        return@AsyncFunction
      }
      val wanted = "Huddle-${code.uppercase()}"
      val settled = AtomicBoolean(false)
      val handler = Handler(Looper.getMainLooper())
      lateinit var discovery: NsdManager.DiscoveryListener

      fun finish(value: Map<String, Any>?) {
        if (!settled.compareAndSet(false, true)) return
        runCatching { manager.stopServiceDiscovery(discovery) }
        promise.resolve(value)
      }

      discovery = object : NsdManager.DiscoveryListener {
        override fun onDiscoveryStarted(serviceType: String) {}
        override fun onDiscoveryStopped(serviceType: String) {}
        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) = finish(null)
        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        override fun onServiceLost(service: NsdServiceInfo) {}
        override fun onServiceFound(service: NsdServiceInfo) {
          if (service.serviceName != wanted) return
          @Suppress("DEPRECATION")
          manager.resolveService(service, object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) = finish(null)
            override fun onServiceResolved(info: NsdServiceInfo) {
              // Prefer the TV's own IPv4 list: a resolved address is often IPv6 link-local.
              val txtHosts = info.attributes["hosts"]?.toString(Charsets.UTF_8)?.split(",")?.filter { it.isNotBlank() }.orEmpty()
              @Suppress("DEPRECATION")
              val hosts = txtHosts.ifEmpty { listOfNotNull(info.host?.hostAddress) }
              if (hosts.isEmpty()) finish(null) else finish(mapOf("hosts" to hosts, "port" to info.port, "name" to info.serviceName))
            }
          })
        }
      }
      manager.discoverServices("_huddle._tcp", NsdManager.PROTOCOL_DNS_SD, discovery)
      handler.postDelayed({ finish(null) }, timeoutMs.toLong())
    }
  }
}
