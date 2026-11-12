package app.phonecare.diagnostics.data

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.display.DisplayManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import android.view.Display
import java.io.File
import java.util.Locale

/**
 * Real readings from the Android framework for the device-diagnostic screens.
 *
 * Same rules as the network collectors: a value that the platform does not expose is
 * null with a reason, never a plausible-looking placeholder. Browser values are never
 * used here, and nothing here is written anywhere except the user's own report.
 */
object DeviceData {

    // ---------------------------------------------------------------- identity

    data class Identity(
        val rows: List<Pair<String, String>>,
        val notes: List<String>,
    )

    fun identity(context: Context): Identity {
        val activityManager = context.getSystemService(ActivityManager::class.java)
        val memory = ActivityManager.MemoryInfo().also { activityManager?.getMemoryInfo(it) }
        val rows = linkedMapOf<String, String>()
        rows["Manufacturer"] = Build.MANUFACTURER.orEmpty().ifBlank { "unknown" }
        rows["Model"] = Build.MODEL.orEmpty().ifBlank { "unknown" }
        rows["Device"] = Build.DEVICE.orEmpty().ifBlank { "unknown" }
        rows["Product"] = Build.PRODUCT.orEmpty().ifBlank { "unknown" }
        rows["Android"] = "${Build.VERSION.RELEASE.orEmpty()} (API ${Build.VERSION.SDK_INT})"
        rows["Security patch"] = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Build.VERSION.SECURITY_PATCH.orEmpty().ifBlank { "not reported" }
        } else {
            "not reported"
        }
        rows["Build id"] = Build.ID.orEmpty().ifBlank { "unknown" }
        rows["ABI"] = Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"
        rows["CPU cores"] = Runtime.getRuntime().availableProcessors().toString()
        rows["Physical RAM"] = memory.totalMem.takeIf { it > 0 }?.let { bytes(it) } ?: "not reported"
        rows["Available RAM"] = memory.availMem.takeIf { it > 0 }?.let { bytes(it) } ?: "not reported"
        rows["Uptime"] = duration(SystemClock.elapsedRealtime())
        rows["Locale"] = Locale.getDefault().toLanguageTag()
        rows["App version"] = appVersion(context) ?: "unknown"

        return Identity(
            rows = rows.map { it.key to it.value },
            notes = listOf(
                "Serial numbers, IMEI, advertising ID and phone number are never read.",
                "Browser-based diagnostics on the website can read far less than this — the two are labelled separately.",
            ),
        )
    }

    fun appVersion(context: Context): String? = runCatching {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        "${info.versionName} (${info.longVersionCode})"
    }.getOrNull()

    // ----------------------------------------------------------------- battery

    data class Battery(
        val levelPct: Int?,
        val status: String?,
        val plugged: String?,
        val health: String?,
        val temperatureC: Double?,
        val voltageMv: Int?,
        val technology: String?,
        val chargeCounterUah: Int?,
        val currentNowUa: Int?,
        val powerSave: Boolean?,
        val notes: List<String>,
    )

    fun battery(context: Context): Battery {
        val manager = context.getSystemService(BatteryManager::class.java)
        val sticky = runCatching {
            context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        }.getOrNull()

        val level = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            ?.takeIf { it in 0..100 }
        val status = sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)?.let { code ->
            when (code) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
                BatteryManager.BATTERY_STATUS_FULL -> "Full"
                BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not charging"
                else -> "Unknown"
            }
        }
        val plugged = sticky?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)?.let { code ->
            when (code) {
                0 -> "Unplugged"
                BatteryManager.BATTERY_PLUGGED_AC -> "AC"
                BatteryManager.BATTERY_PLUGGED_USB -> "USB"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
                else -> "Other"
            }
        }
        val health = sticky?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)?.let { code ->
            when (code) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat"
                BatteryManager.BATTERY_HEALTH_DEAD -> "Dead"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over voltage"
                BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
                BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "Failure"
                else -> "Unknown"
            }
        }
        val tempTenths = sticky?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
            ?.takeIf { it != Int.MIN_VALUE }
        return Battery(
            levelPct = level ?: sticky?.let { intent ->
                val raw = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                if (raw >= 0 && scale > 0) (raw * 100.0 / scale).toInt() else null
            },
            status = status,
            plugged = plugged,
            health = health,
            temperatureC = tempTenths?.let { it / 10.0 },
            voltageMv = sticky?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)?.takeIf { it > 0 },
            technology = sticky?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)?.takeIf { it.isNotBlank() },
            chargeCounterUah = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER)
                ?.takeIf { it > 0 },
            currentNowUa = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
                ?.takeIf { it != Int.MIN_VALUE && it != 0 },
            powerSave = context.getSystemService(PowerManager::class.java)?.isPowerSaveMode,
            notes = listOf(
                "Capacity, charge counter and current come from the fuel gauge; many OEMs return 0 or Int.MIN_VALUE, shown as unavailable.",
                "Battery health is a coarse OEM flag, not a measurement of remaining capacity.",
                "Battery temperature is not CPU temperature — the website cannot read either.",
            ),
        )
    }

    // ----------------------------------------------------------------- storage

    data class StorageEntry(val label: String, val totalBytes: Long, val freeBytes: Long)

    data class Storage(
        val entries: List<StorageEntry>,
        val notes: List<String>,
    )

    fun storage(context: Context): Storage {
        val entries = mutableListOf<StorageEntry>()
        runCatching { StatFs(context.filesDir.absolutePath) }.getOrNull()?.let {
            entries += StorageEntry("App data", it.totalBytes, it.availableBytes)
        }
        runCatching { StatFs(File("/data").absolutePath) }.getOrNull()?.let {
            if (it.totalBytes > 0 && entries.none { e -> e.totalBytes == it.totalBytes }) {
                entries += StorageEntry("Internal storage", it.totalBytes, it.availableBytes)
            }
        }
        val cache = runCatching {
            context.cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        }.getOrDefault(0L)
        return Storage(
            entries = entries,
            notes = listOf(
                "Cache currently holds ${bytes(cache)}." + " Clearing the cache is a system action; this app never deletes files on its own.",
                "Only app-accessible volumes are visible. Other apps' usage requires privileged access.",
                "The website can only estimate storage from the StorageManager quota API, which most browsers do not expose.",
            ),
        )
    }

    // ----------------------------------------------------------------- thermal

    data class Thermal(
        val statusLabel: String?,
        val statusCode: Int?,
        val batteryTemperatureC: Double?,
        val powerSave: Boolean?,
        val deviceIdle: Boolean?,
        val supported: Boolean,
        val notes: List<String>,
    )

    fun thermal(context: Context): Thermal {
        val power = context.getSystemService(PowerManager::class.java)
        val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        val code = if (supported) power?.currentThermalStatus else null
        val label = code?.let { status ->
            when (status) {
                PowerManager.THERMAL_STATUS_NONE -> "Nominal"
                PowerManager.THERMAL_STATUS_LIGHT -> "Light throttling"
                PowerManager.THERMAL_STATUS_MODERATE -> "Moderate throttling"
                PowerManager.THERMAL_STATUS_SEVERE -> "Severe throttling"
                PowerManager.THERMAL_STATUS_CRITICAL -> "Critical"
                PowerManager.THERMAL_STATUS_EMERGENCY -> "Emergency"
                PowerManager.THERMAL_STATUS_SHUTDOWN -> "Shutdown imminent"
                else -> "Unknown ($status)"
            }
        }
        return Thermal(
            statusLabel = label,
            statusCode = code,
            batteryTemperatureC = battery(context).temperatureC,
            powerSave = power?.isPowerSaveMode,
            deviceIdle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) power?.isDeviceIdleMode else null,
            supported = supported,
            notes = listOf(
                if (supported) {
                    "Thermal status is a coarse OS classification, not a per-zone temperature."
                } else {
                    "Per-app thermal status requires Android 10 (API 29); this device reports only battery temperature."
                },
                "CPU/GPU die temperatures are not readable by third-party apps without root.",
                "If the phone is hot at rest, stop using it and consult a service centre — throttling data is not a safety diagnosis.",
            ),
        )
    }

    // ----------------------------------------------------------------- display

    data class DisplayInfo(
        val widthPx: Int,
        val heightPx: Int,
        val densityDpi: Int,
        val refreshRateHz: Float,
        val supportedRefreshRates: List<Float>,
        val hdrTypes: List<String>,
        val screenInches: Double?,
        val notes: List<String>,
    )

    @Suppress("DEPRECATION")
    fun display(context: Context): DisplayInfo {
        val metrics = context.resources.displayMetrics
        val manager = context.getSystemService(DisplayManager::class.java)
        val display = manager?.getDisplay(Display.DEFAULT_DISPLAY)
        val rates = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            display?.supportedModes?.map { it.refreshRate }?.distinct()?.sorted() ?: emptyList()
        } else {
            emptyList()
        }
        val hdr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            display?.hdrCapabilities?.supportedHdrTypes?.map { hdrName(it) } ?: emptyList()
        } else {
            emptyList()
        }
        val widthInches = metrics.widthPixels / metrics.xdpi.toDouble()
        val heightInches = metrics.heightPixels / metrics.ydpi.toDouble()
        val diagonal = runCatching { Math.hypot(widthInches, heightInches) }.getOrNull()
        return DisplayInfo(
            widthPx = metrics.widthPixels,
            heightPx = metrics.heightPixels,
            densityDpi = metrics.densityDpi,
            refreshRateHz = display?.refreshRate ?: 0f,
            supportedRefreshRates = rates,
            hdrTypes = hdr,
            screenInches = diagonal?.takeIf { it in 2.0..30.0 },
            notes = listOf(
                "Physical size is computed from reported pixels and DPI; panels round these numbers.",
                "Brightness control requires WRITE_SETTINGS, which this app does not request.",
                "Dead-pixel and uniformity checks are visual: the app shows solid colours, the user judges.",
            ),
        )
    }

    private fun hdrName(type: Int): String = when (type) {
        Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION -> "Dolby Vision"
        Display.HdrCapabilities.HDR_TYPE_HDR10 -> "HDR10"
        Display.HdrCapabilities.HDR_TYPE_HLG -> "HLG"
        Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS -> "HDR10+"
        else -> "type $type"
    }

    // ------------------------------------------------------------- performance

    data class Performance(
        val opsPerSecond: Long?,
        val iterations: Int,
        val durationMs: Long,
        val memoryClassMb: Int?,
        val largeMemoryClassMb: Int?,
        val cores: Int,
        val notes: List<String>,
    )

    /** Runs a deterministic integer workload. Not a benchmark of the phone's real apps. */
    fun performance(context: Context): Performance {
        val activityManager = context.getSystemService(ActivityManager::class.java)
        val iterations = 6_000_000
        var accumulator = 0L
        val started = System.nanoTime()
        var i = 0
        while (i < iterations) {
            accumulator += ((i xor (i shr 3)) * 31L) % 1000003L
            i++
        }
        val elapsedNs = System.nanoTime() - started
        val seconds = elapsedNs / 1_000_000_000.0
        val ops = if (seconds > 0) (iterations / seconds).toLong() else null
        return Performance(
            opsPerSecond = ops?.takeIf { accumulator != Long.MIN_VALUE },
            iterations = iterations,
            durationMs = elapsedNs / 1_000_000,
            memoryClassMb = activityManager?.memoryClass,
            largeMemoryClassMb = activityManager?.largeMemoryClass,
            cores = Runtime.getRuntime().availableProcessors(),
            notes = listOf(
                "This is a warm-up-sensitive integer loop, useful for comparing the same phone before/after, not for comparing brands.",
                "Thermal throttling directly changes the result — run it cool and note the device temperature.",
                "The website measures JavaScript execution instead; the numbers are not comparable.",
            ),
        )
    }

    // ----------------------------------------------------------- compatibility

    data class Feature(val name: String, val supported: Boolean, val note: String)

    fun compatibility(context: Context): List<Feature> {
        val pm = context.packageManager
        fun has(feature: String) = runCatching { pm.hasSystemFeature(feature) }.getOrDefault(false)
        return listOf(
            Feature("Telephony", has(android.content.pm.PackageManager.FEATURE_TELEPHONY), "SIM slot and modem"),
            Feature("GSM / CDMA", has(android.content.pm.PackageManager.FEATURE_TELEPHONY_GSM) || has(android.content.pm.PackageManager.FEATURE_TELEPHONY_CDMA), "legacy RAT support"),
            Feature("Wi-Fi", has(android.content.pm.PackageManager.FEATURE_WIFI), "802.11 radio"),
            Feature("Wi-Fi Direct", has(android.content.pm.PackageManager.FEATURE_WIFI_DIRECT), "peer-to-peer"),
            Feature("Bluetooth", has(android.content.pm.PackageManager.FEATURE_BLUETOOTH), "classic"),
            Feature("Bluetooth LE", has(android.content.pm.PackageManager.FEATURE_BLUETOOTH_LE), "low energy"),
            Feature("NFC", has(android.content.pm.PackageManager.FEATURE_NFC), "contactless"),
            Feature("GPS", has(android.content.pm.PackageManager.FEATURE_LOCATION_GPS), "satellite positioning"),
            Feature("Camera", has(android.content.pm.PackageManager.FEATURE_CAMERA_ANY), "any camera"),
            Feature("Fingerprint", has(android.content.pm.PackageManager.FEATURE_FINGERPRINT), "biometric"),
            Feature("Face unlock", has(android.content.pm.PackageManager.FEATURE_FACE), "biometric"),
            Feature("Vulkan", has(android.content.pm.PackageManager.FEATURE_VULKAN_HARDWARE_VERSION), "graphics API"),
            Feature("Touchscreen", has(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN), "input"),
            Feature("Multitouch (5+)", has(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN_MULTITOUCH_DISTINCT), "distinct pointers"),
            Feature("USB host", has(android.content.pm.PackageManager.FEATURE_USB_HOST), "OTG"),
            Feature("5G NR (reported)", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q, "requires API 29+ for NR cell info"),
        )
    }

    // -------------------------------------------------------------- formatting

    fun bytes(value: Long): String {
        if (value <= 0) return "—"
        val units = listOf("B", "KB", "MB", "GB", "TB")
        var size = value.toDouble()
        var unit = 0
        while (size >= 1024 && unit < units.lastIndex) {
            size /= 1024
            unit++
        }
        return String.format(Locale.US, "%.1f %s", size, units[unit])
    }

    fun duration(millis: Long): String {
        val totalSeconds = millis / 1000
        val days = totalSeconds / 86_400
        val hours = (totalSeconds % 86_400) / 3600
        val minutes = (totalSeconds % 3600) / 60
        return when {
            days > 0 -> "${days}d ${hours}h"
            hours > 0 -> "${hours}h ${minutes}m"
            else -> "${minutes}m"
        }
    }

    /** Non-null shortcut for Settings.Global reads that some OEMs block. */
    fun globalSetting(context: Context, key: String): String? = runCatching {
        Settings.Global.getString(context.contentResolver, key)
    }.getOrNull()
}
