package app.phonecare.diagnostics.wifi

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.MeasureUnit
import app.phonecare.diagnostics.core.Uncertainty
import java.time.Instant

/**
 * Connected-link information — not a site survey.
 *
 * Uses NetworkCapabilities (API 29+) instead of the deprecated
 * WifiManager.getConnectionInfo() path. No Wi-Fi scanning: scan results need
 * location permission and would not tell us anything about the router's own
 * transmit power, which is what users usually want to know.
 */
class WifiCollector(private val context: Context) {

    data class Snapshot(
        val connected: Boolean,
        val ssid: String?,
        val band: String?,
        val measurements: List<Measurement>,
        /** Default-route gateway as reported by the OS; null when the link has no IPv4/V6 route. */
        val gateway: String?,
        val dnsServers: List<String>,
        val notes: List<String>,
    )

    fun collect(): Snapshot {
        val at = Instant.now()
        val notes = mutableListOf<String>()
        val measurements = mutableListOf<Measurement>()

        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        if (connectivity == null) {
            return Snapshot(
                connected = false,
                ssid = null,
                band = null,
                measurements = emptyList(),
                gateway = null,
                dnsServers = emptyList(),
                notes = listOf("ConnectivityManager is unavailable on this device."),
            )
        }

        val network = connectivity.activeNetwork
        val capabilities = network?.let { connectivity.getNetworkCapabilities(it) }
        val linkProperties: LinkProperties? = network?.let { connectivity.getLinkProperties(it) }

        val transport = when {
            capabilities == null -> "unknown"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "unknown"
        }

        if (capabilities != null) {
            measurements += Measurement(
                id = "net.internet_capability",
                label = "Internet capability",
                value = if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) 1.0 else 0.0,
                unit = MeasureUnit.COUNT,
                evidence = Evidence.MEASURED,
                source = "NetworkCapabilities.NET_CAPABILITY_INTERNET",
                availability = Availability.AVAILABLE,
                timestamp = at,
                notes = listOf("1 = the OS believes this network offers internet access."),
            )
            measurements += Measurement(
                id = "net.internet_validated",
                label = "Internet validated",
                value = if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) 1.0 else 0.0,
                unit = MeasureUnit.COUNT,
                evidence = Evidence.MEASURED,
                source = "NetworkCapabilities.NET_CAPABILITY_VALIDATED",
                availability = Availability.AVAILABLE,
                timestamp = at,
                notes = listOf(
                    "1 = Android's captive-portal check succeeded. 0 often means a login page or a broken uplink.",
                ),
            )
        }

        val gatewayAddress = linkProperties?.routes
            ?.firstOrNull { it.isDefaultRoute }
            ?.gateway
            ?.hostAddress
        val resolvers = linkProperties?.dnsServers?.mapNotNull { it.hostAddress } ?: emptyList()

        if (transport != "wifi") {
            notes += "The active network is $transport; Wi-Fi link metrics are not applicable right now."
            return Snapshot(
                connected = false,
                ssid = null,
                band = null,
                measurements = measurements,
                gateway = gatewayAddress,
                dnsServers = resolvers,
                notes = notes,
            )
        }

        val wifiInfo = readWifiInfo(connectivity, capabilities)
        if (wifiInfo == null) {
            measurements += Measurement.unavailable(
                id = "wifi.rssi",
                label = "Wi-Fi RSSI",
                unit = MeasureUnit.DBM,
                source = "NetworkCapabilities.getTransportInfo",
                availability = Availability.TRANSIENT,
                at = at,
                notes = listOf("The platform did not expose a WifiInfo for the active network."),
            )
            return Snapshot(
                connected = true,
                ssid = null,
                band = null,
                measurements = measurements,
                gateway = gatewayAddress,
                dnsServers = resolvers,
                notes = notes,
            )
        }

        // --- RSSI --------------------------------------------------------
        // NetworkCapabilities.getSignalStrength() only exists on API 29+. Calling it on
        // Android 8/9 would throw NoSuchMethodError at runtime, which is why the access is
        // guarded by the SDK check rather than by the ?. operator alone.
        val platformRssi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            capabilities?.signalStrength
        } else {
            null
        }
        @Suppress("DEPRECATION")
        val legacyRssi = wifiInfo.rssi
        val (rssi, rssiSource) = if (platformRssi != null && platformRssi in -120..0) {
            platformRssi to "NetworkCapabilities.getSignalStrength()"
        } else {
            legacyRssi to "WifiInfo.getRssi() (deprecated path, or the platform value was INVALID)"
        }
        if (rssi in -120..0) {
            measurements += Measurement(
                id = "wifi.rssi",
                label = "Wi-Fi RSSI",
                value = rssi.toDouble(),
                unit = MeasureUnit.DBM,
                evidence = Evidence.MEASURED,
                source = rssiSource,
                availability = Availability.AVAILABLE,
                timestamp = at,
                uncertainty = Uncertainty(Uncertainty.Kind.RESOLUTION, 3.0, "dBm"),
                sampleCount = 1,
                notes = listOf("Many OEM drivers quantise RSSI to 3 dB steps."),
            )
        } else {
            measurements += Measurement.unavailable(
                id = "wifi.rssi",
                label = "Wi-Fi RSSI",
                unit = MeasureUnit.DBM,
                source = "NetworkCapabilities.getSignalStrength()",
                availability = Availability.TRANSIENT,
                at = at,
                notes = listOf("The driver returned an invalid RSSI ($rssi)."),
            )
        }

        // --- Frequency / band -------------------------------------------
        val frequency = wifiInfo.frequency
        if (frequency > 0) {
            val band = bandFor(frequency)
            measurements += Measurement(
                id = "wifi.frequency",
                label = "Wi-Fi frequency",
                value = frequency.toDouble(),
                unit = MeasureUnit.MHZ,
                evidence = Evidence.MEASURED,
                source = "WifiInfo.getFrequency()",
                availability = Availability.AVAILABLE,
                timestamp = at,
                context = mapOf("band" to band),
            )
        }

        // --- Link speed --------------------------------------------------
        val linkSpeed = wifiInfo.linkSpeed
        if (linkSpeed > 0) {
            measurements += Measurement(
                id = "wifi.link_speed",
                label = "Wi-Fi link speed",
                value = linkSpeed.toDouble(),
                unit = MeasureUnit.MBPS,
                evidence = Evidence.MEASURED,
                source = "WifiInfo.getLinkSpeed()",
                availability = Availability.AVAILABLE,
                timestamp = at,
                notes = listOf("The negotiated PHY rate between phone and access point, not your internet speed."),
            )
        }

        // --- SSID --------------------------------------------------------
        val ssid = readSsid(wifiInfo)
        if (ssid == null) {
            notes += "SSID is hidden. Android masks it unless location services are on and location permission " +
                "is granted; on Android 13+ the SSID also needs NEARBY_WIFI_DEVICES, which this build declares " +
                "but intentionally never requests because it does not scan."
        }

        // --- DNS servers (informational, not a measurement) --------------
        linkProperties?.dnsServers?.takeIf { it.isNotEmpty() }?.let { servers ->
            notes += "Resolver(s) reported by the network: ${servers.joinToString { it.hostAddress ?: "?" }}. " +
                "A DNS change must be made in the router; this app never changes it."
        }

        notes += "Wi-Fi transmit power and channel width are controlled by the access point and are not readable from an app."
        return Snapshot(
            connected = true,
            ssid = ssid,
            band = bandFor(wifiInfo.frequency),
            measurements = measurements,
            gateway = gatewayAddress,
            dnsServers = resolvers,
            notes = notes,
        )
    }

    private fun readWifiInfo(
        connectivity: ConnectivityManager,
        capabilities: NetworkCapabilities?,
    ): WifiInfo? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return capabilities?.transportInfo as? WifiInfo
        }
        val wifiManager = context.applicationContext.getSystemService(WifiManager::class.java) ?: return null
        @Suppress("DEPRECATION")
        return wifiManager.connectionInfo
    }

    private fun readSsid(info: WifiInfo): String? {
        val granted = context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) return null
        val ssid = info.ssid ?: return null
        val cleaned = ssid.trim('"')
        return cleaned.takeIf { it.isNotBlank() && !it.contains("unknown", ignoreCase = true) }
    }

    private fun bandFor(frequency: Int): String = when (frequency) {
        in 2400..2500 -> "2.4 GHz"
        in 4900..5900 -> "5 GHz"
        in 5925..7125 -> "6 GHz"
        else -> "unknown"
    }
}
