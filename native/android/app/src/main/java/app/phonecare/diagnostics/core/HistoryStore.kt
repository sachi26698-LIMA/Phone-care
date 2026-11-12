package app.phonecare.diagnostics.core

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Diagnostic history.
 *
 * Only reports the user explicitly saved are stored, and they live in app-private
 * preferences — no cloud, no analytics, no background writes. Each entry keeps the
 * full `phonecare.report/1` JSON so a saved run can be exported or compared later.
 */
class HistoryStore(private val context: Context) {

    data class Entry(
        val id: String,
        val generatedAt: Instant,
        val transport: String,
        val headline: String,
        val score: Int?,
        val measurementCount: Int,
        val json: String,
    )

    private val prefs get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun all(): List<Entry> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                runCatching { decode(array.getJSONObject(index)) }.getOrNull()
            }
        }.getOrDefault(emptyList())
    }

    fun append(report: DiagnosticReport, json: String): List<Entry> {
        val entry = Entry(
            id = report.id,
            generatedAt = report.generatedAt,
            transport = report.network.transport,
            headline = headline(report),
            score = report.measurements.firstOrNull { it.id == "net.quality.index" }?.value?.toInt(),
            measurementCount = report.measurements.size,
            json = json,
        )
        val updated = (listOf(entry) + all()).take(MAX_ENTRIES)
        write(updated)
        return updated
    }

    fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    fun count(): Int = all().size

    private fun write(entries: List<Entry>) {
        val array = JSONArray()
        entries.forEach { entry ->
            array.put(
                JSONObject().apply {
                    put("id", entry.id)
                    put("generatedAt", entry.generatedAt.toString())
                    put("transport", entry.transport)
                    put("headline", entry.headline)
                    put("score", entry.score ?: JSONObject.NULL)
                    put("measurementCount", entry.measurementCount)
                    put("json", entry.json)
                },
            )
        }
        prefs.edit().putString(KEY, array.toString()).apply()
    }

    private fun decode(obj: JSONObject) = Entry(
        id = obj.getString("id"),
        generatedAt = Instant.parse(obj.getString("generatedAt")),
        transport = obj.optString("transport", "unknown"),
        headline = obj.optString("headline", ""),
        score = if (obj.isNull("score")) null else obj.optInt("score"),
        measurementCount = obj.optInt("measurementCount", 0),
        json = obj.optString("json", "{}"),
    )

    private fun headline(report: DiagnosticReport): String {
        val latency = report.measurements.firstOrNull { it.id == "net.latency.median" }?.value
        val download = report.measurements.firstOrNull { it.id == "net.download.mbps" }?.value
        val rsrp = report.measurements.firstOrNull { it.id == "lte.rsrp" || it.id == "nr.ss_rsrp" }?.value
        val parts = mutableListOf<String>()
        latency?.let { parts += "%.0f ms".format(it) }
        download?.let { parts += "%.1f Mbps".format(it) }
        rsrp?.let { parts += "%.0f dBm".format(it) }
        return if (parts.isEmpty()) "No measurements" else parts.joinToString(" · ")
    }

    private companion object {
        const val PREFS = "phonecare.history"
        const val KEY = "runs"
        const val MAX_ENTRIES = 20
    }
}
