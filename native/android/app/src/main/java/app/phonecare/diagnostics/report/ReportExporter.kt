package app.phonecare.diagnostics.report

import android.content.Context
import android.content.Intent
import android.os.Build
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.core.DeviceInfo
import app.phonecare.diagnostics.core.Measurement
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Serialises a report exactly as shared/diagnostics.schema.json expects.
 *
 * `JSONObject.put(key, null)` removes the key, so nullable fields are written
 * with JSONObject.NULL explicitly. Forgetting that produces a report the website
 * rejects — which is the contract doing its job.
 */
class ReportExporter(private val context: Context) {

    fun build(report: DiagnosticReport): JSONObject = JSONObject().apply {
        put("schemaVersion", DiagnosticReport.SCHEMA_VERSION)
        put("id", report.id)
        put("generatedAt", report.generatedAt.toString())
        put("platform", "android")
        put("app", JSONObject().apply {
            put("name", report.app.name)
            put("version", report.app.version)
            put("build", report.app.build ?: JSONObject.NULL)
        })
        put("device", JSONObject().apply {
            put("manufacturer", report.device.manufacturer ?: JSONObject.NULL)
            put("model", report.device.model ?: JSONObject.NULL)
            put("osVersion", report.device.osVersion ?: JSONObject.NULL)
            put("sdkInt", report.device.sdkInt ?: JSONObject.NULL)
        })
        put("session", JSONObject().apply {
            put("startedAt", report.session.startedAt.toString())
            put("durationMs", report.session.durationMs)
            put("trigger", report.session.trigger)
        })
        put("network", JSONObject().apply {
            put("transport", report.network.transport)
            put("carrier", report.network.carrier ?: JSONObject.NULL)
            put("server", report.network.server ?: JSONObject.NULL)
            if (report.network.sims.isNotEmpty()) {
                put("sims", JSONArray().apply {
                    report.network.sims.forEach { sim ->
                        put(JSONObject().apply {
                            put("slot", sim.slot)
                            put("carrier", sim.carrier ?: JSONObject.NULL)
                            put("rat", sim.rat ?: JSONObject.NULL)
                            put("roaming", sim.roaming ?: JSONObject.NULL)
                            put("active", sim.active ?: JSONObject.NULL)
                        })
                    }
                })
            }
        })
        put("measurements", JSONArray().apply {
            report.measurements.forEach { put(measurement(it)) }
        })
        put("limitations", JSONArray().apply { report.limitations.forEach { put(it) } })
    }

    private fun measurement(measurement: Measurement): JSONObject = JSONObject().apply {
        put("id", measurement.id)
        put("label", measurement.label)
        put("value", measurement.value ?: JSONObject.NULL)
        put("unit", measurement.unit.json)
        put("evidence", measurement.evidence.json)
        put("source", measurement.source)
        put("availability", measurement.availability.json)
        put("timestamp", measurement.timestamp.toString())
        measurement.uncertainty?.let { uncertainty ->
            put("uncertainty", JSONObject().apply {
                put("kind", uncertainty.kind.json)
                put("value", uncertainty.value ?: JSONObject.NULL)
                put("unit", uncertainty.unit)
            })
        }
        measurement.sampleCount?.let { put("sampleCount", it) }
        if (measurement.context.isNotEmpty()) {
            put("context", JSONObject().apply { measurement.context.forEach { (key, value) -> put(key, value) } })
        }
        if (measurement.notes.isNotEmpty()) {
            put("notes", JSONArray().apply { measurement.notes.forEach { put(it) } })
        }
    }

    fun write(report: DiagnosticReport): File {
        val file = File(context.cacheDir, "phonecare-report-${report.id.take(8)}.json")
        file.writeText(build(report).toString(2))
        return file
    }

    fun shareIntent(report: DiagnosticReport): Intent {
        // Shared as text, not a file URI: a FileProvider needs a manifest entry and
        // grants broad read access to a cache directory. A report is small JSON, so
        // the text share keeps the surface minimal and works with any mail/chat app.
        val json = build(report).toString(2)
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "PhoneCare diagnostic report")
            putExtra(Intent.EXTRA_TEXT, json)
        }
    }

    companion object {
        /** Builds the device block from Build.*; every value is optional. */
        fun deviceInfo(): DeviceInfo = DeviceInfo(
            manufacturer = Build.MANUFACTURER?.takeIf { it.isNotBlank() },
            model = Build.MODEL?.takeIf { it.isNotBlank() },
            osVersion = Build.VERSION.RELEASE?.takeIf { it.isNotBlank() },
            sdkInt = Build.VERSION.SDK_INT,
        )
    }
}
