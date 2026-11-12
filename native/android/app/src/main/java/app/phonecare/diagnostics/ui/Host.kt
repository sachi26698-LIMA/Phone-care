package app.phonecare.diagnostics.ui

import android.content.Context
import android.view.View
import app.phonecare.diagnostics.core.AppState
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.permissions.PermissionManager
import app.phonecare.diagnostics.screens.*

/** Bottom-navigation destinations. Order matches the website's information architecture. */
enum class Tab(val label: String) {
    HOME("Home"),
    DIAGNOSTICS("Diagnose"),
    NETWORK("Network"),
    RESULTS("Results"),
    MORE("More"),
}

/**
 * Everything a screen needs from the shell. Screens never touch the Activity directly,
 * which keeps them testable, predictable and free of lifecycle surprises.
 */
interface Host {
    val context: Context
    val state: AppState
    val permissions: PermissionManager

    /** Tab roots and pushed screens share one back stack. */
    fun navigate(screen: Screen)
    fun switchTab(tab: Tab)
    fun back(): Boolean

    /** Small status line under the app bar. */
    fun status(message: String)

    /** Runs [task] on the background executor, then re-renders the current screen. */
    fun background(label: String, task: () -> Unit)
    fun backgroundWithUi(label: String, task: (done: (() -> Unit) -> Unit) -> Unit)

    /** Posts to the UI thread. */
    fun ui(block: () -> Unit)

    /** Re-renders the current screen from state. */
    fun refresh()

    fun shareReport(report: DiagnosticReport)
    fun shareJson(json: String, subject: String)
    fun toast(message: String)

    fun hasCellularPermissions(): Boolean
    fun requestCellularPermissions()
    fun openAppSettings()
    fun openNetworkSettings()
    fun openWifiCallingSettings()

    fun isRunning(): Boolean
}

/** A screen is a pure function of the host and its state. */
enum class Screen(val title: String, val tab: Tab?, private val renderer: (Host) -> View) {
    DASHBOARD("Dashboard", Tab.HOME, { dashboardScreen(it) }),
    DIAGNOSTICS_HUB("Diagnostics", Tab.DIAGNOSTICS, { diagnosticsHubScreen(it) }),
    NETWORK_HUB("Network", Tab.NETWORK, { networkHubScreen(it) }),
    RESULTS("Results", Tab.RESULTS, { resultsScreen(it) }),
    MORE("More", Tab.MORE, { moreScreen(it) }),

    DEVICE("Device identity", null, { deviceScreen(it) }),
    BATTERY("Battery & health", null, { batteryScreen(it) }),
    STORAGE("Storage", null, { storageScreen(it) }),
    TEMPERATURE("Temperature", null, { temperatureScreen(it) }),
    DISPLAY("Display", null, { displayScreen(it) }),
    TOUCH("Touch", null, { touchScreen(it) }),
    PERFORMANCE("Performance", null, { performanceScreen(it) }),
    COMPATIBILITY("Compatibility", null, { compatibilityScreen(it) }),

    CELLULAR("Cellular", null, { cellularScreen(it) }),
    WIFI("Wi-Fi", null, { wifiScreen(it) }),
    QUALITY("Internet quality", null, { qualityScreen(it) }),
    SURVEY("Indoor survey", null, { surveyScreen(it) }),
    TROUBLESHOOT("Troubleshoot", null, { troubleshootScreen(it) }),

    GUIDES("Guides", null, { guidesScreen(it) }),
    GUIDE_DETAIL("Guide", null, { guideDetailScreen(it) }),
    ASSISTANT("Assistant", null, { assistantScreen(it) }),
    METHODOLOGY("Methodology", null, { methodologyScreen(it) }),
    SETTINGS("Settings", null, { settingsScreen(it) }),
    PRIVACY("Privacy & permissions", null, { privacyScreen(it) });

    fun render(host: Host): View = renderer(host)

    companion object {
        fun forTab(tab: Tab): Screen = entries.first { it.tab == tab }
    }
}
