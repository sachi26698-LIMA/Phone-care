package app.phonecare.diagnostics.core

import android.content.Context
import app.phonecare.diagnostics.cellular.CellularCollector
import app.phonecare.diagnostics.net.ConnectivityMonitor
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.report.ReportExporter
import app.phonecare.diagnostics.survey.SurveySession
import app.phonecare.diagnostics.wifi.WifiCollector
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * The single source of truth for a session.
 *
 * Screens read from here; collectors write here. Nothing is cached to disk except the
 * survey and the history the user explicitly saved.
 */
class AppState(private val context: Context) {

    val cellularCollector = CellularCollector(context)
    val wifiCollector = WifiCollector(context)
    val surveySession = SurveySession(context)
    val exporter = ReportExporter(context)
    val history = HistoryStore(context)

    val sessionStarted: Instant = Instant.now()

    var cellular: CellularCollector.Snapshot? = null
    var wifi: WifiCollector.Snapshot? = null
    var quality: InternetQualityEngine.Result? = null
    var connectivity: ConnectivityMonitor.Events? = null
    var survey: SurveySession.Survey = surveySession.load()

    /** Test server used by the quality engine; editable in Settings and persisted. */
    var serverUrl: String = context.getSharedPreferences("phonecare.settings", Context.MODE_PRIVATE)
        .getString("serverUrl", DEFAULT_SERVER) ?: DEFAULT_SERVER
        set(value) {
            field = value
            context.getSharedPreferences("phonecare.settings", Context.MODE_PRIVATE)
                .edit().putString("serverUrl", value).apply()
        }

    var performance: app.phonecare.diagnostics.data.DeviceData.Performance? = null
    var lastRunAt: Instant? = null
    var runsCompleted: Int = 0
    var selectedGuideSlug: String? = null

    /** RSRP from either LTE or NR, so 5G-only cells still feed the guidance rules. */
    val rsrpDbm: Double?
        get() = cellular?.rsrpDbm

    val transport: String
        get() = when {
            wifi?.connected == true -> "wifi"
            cellular != null -> "cellular"
            else -> "unknown"
        }

    fun buildReport(): DiagnosticReport = ReportBuilder.build(context, this)

    fun reportJson(report: DiagnosticReport): String = exporter.build(report).toString(2)

    fun saveRun(report: DiagnosticReport) {
        history.append(report, reportJson(report))
        lastRunAt = Instant.now()
        runsCompleted += 1
    }

    fun sessionDurationMs(): Long = Duration.between(sessionStarted, Instant.now()).toMillis()

    companion object {
        const val DEFAULT_SERVER = "https://phonecare.app"

        fun newId(): String = UUID.randomUUID().toString()
    }
}
