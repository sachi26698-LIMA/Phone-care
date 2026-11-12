package app.phonecare.diagnostics.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import java.time.Instant
import java.util.Collections
import java.util.concurrent.atomic.AtomicInteger

/**
 * Counts network transitions while a test runs.
 *
 * This is the honest version of "interruptions": the OS tells us when a network
 * appears, disappears or changes capabilities. The first callback usually
 * describes the network that was already connected, so its count is reported as
 * a raw number with that caveat instead of being silently subtracted.
 */
class ConnectivityMonitor(private val context: Context) {

    data class Events(
        val available: Int,
        val lost: Int,
        val capabilityChanges: Int,
        val startedAt: Instant,
        val stoppedAt: Instant,
        val transitions: List<String>,
    ) {
        /** Lost-then-recovered or repeated losses are what users feel as drops. */
        val disruptions: Int get() = lost
    }

    private val connectivity: ConnectivityManager? =
        context.getSystemService(ConnectivityManager::class.java)

    private val available = AtomicInteger(0)
    private val lost = AtomicInteger(0)
    private val capabilityChanges = AtomicInteger(0)
    private val transitions = Collections.synchronizedList(mutableListOf<String>())
    private var registered = false
    private var startedAt: Instant = Instant.now()

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            available.incrementAndGet()
            transitions.add("${Instant.now()} available")
        }

        override fun onLost(network: Network) {
            lost.incrementAndGet()
            transitions.add("${Instant.now()} lost")
        }

        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            capabilityChanges.incrementAndGet()
        }
    }

    /** Returns false when the platform refuses to register; callers must handle that. */
    fun start(): Boolean {
        val manager = connectivity ?: return false
        return runCatching {
            manager.registerDefaultNetworkCallback(callback)
            registered = true
            startedAt = Instant.now()
            true
        }.getOrElse { false }
    }

    fun stop(): Events {
        if (registered) {
            runCatching { connectivity?.unregisterNetworkCallback(callback) }
            registered = false
        }
        return Events(
            available = available.get(),
            lost = lost.get(),
            capabilityChanges = capabilityChanges.get(),
            startedAt = startedAt,
            stoppedAt = Instant.now(),
            transitions = synchronized(transitions) { transitions.toList() },
        )
    }
}
