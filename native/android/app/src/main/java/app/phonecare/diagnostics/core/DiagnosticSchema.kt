package app.phonecare.diagnostics.core

import java.time.Instant

/**
 * Kotlin mirror of shared/diagnostics.schema.json (phonecare.report/1).
 *
 * The invariant enforced in Measurement's initialiser is the whole point of the
 * contract: a value that could not be read is null AND marked unavailable. A
 * value with any other evidence level must be a real number. Reports that break
 * this are rejected by /api/reports, so the app cannot silently fabricate data.
 */

enum class Evidence(val json: String) {
    MEASURED("measured"),
    ESTIMATED("estimated"),
    USER("user"),
    UNAVAILABLE("unavailable"),
}

enum class Availability(val json: String) {
    AVAILABLE("available"),
    PERMISSION_DENIED("permission_denied"),
    UNSUPPORTED("unsupported"),
    TRANSIENT("transient"),
}

enum class MeasureUnit(val json: String) {
    DBM("dBm"),
    DB("dB"),
    MS("ms"),
    MBPS("Mbps"),
    PERCENT("%"),
    COUNT("count"),
    MHZ("MHz"),
    DBM_PER_MHZ("dBm/MHz"),
}

data class Uncertainty(
    val kind: Kind,
    val value: Double?,
    val unit: String,
) {
    enum class Kind(val json: String) {
        RESOLUTION("resolution"),
        SAMPLE_SPREAD("sample_spread"),
        NONE("none"),
    }
}

data class Measurement(
    val id: String,
    val label: String,
    val value: Double?,
    val unit: MeasureUnit,
    val evidence: Evidence,
    val source: String,
    val availability: Availability,
    val timestamp: Instant,
    val uncertainty: Uncertainty? = null,
    val sampleCount: Int? = null,
    val context: Map<String, String> = emptyMap(),
    val notes: List<String> = emptyList(),
) {
    init {
        require(id.isNotBlank() && id.length <= 64) { "measurement id must be 1-64 chars" }
        require(label.isNotBlank() && label.length <= 80) { "label must be 1-80 chars" }
        require(source.isNotBlank() && source.length <= 200) { "source must be 1-200 chars" }
        require(value == null || value.isFinite()) { "$id: value must be finite" }
        if (value == null) {
            require(evidence == Evidence.UNAVAILABLE) {
                "$id: a null value must be marked unavailable, not ${evidence.json}"
            }
            require(availability != Availability.AVAILABLE) {
                "$id: a null value cannot be marked available"
            }
        } else {
            require(availability == Availability.AVAILABLE) {
                "$id: a numeric value must be available"
            }
            require(evidence != Evidence.UNAVAILABLE) {
                "$id: numeric value cannot be marked unavailable"
            }
        }
        sampleCount?.let { require(it >= 1) { "$id: sampleCount must be positive" } }
    }

    companion object {
        fun unavailable(
            id: String,
            label: String,
            unit: MeasureUnit,
            source: String,
            availability: Availability,
            at: Instant,
            notes: List<String> = emptyList(),
        ): Measurement = Measurement(
            id = id,
            label = label,
            value = null,
            unit = unit,
            evidence = Evidence.UNAVAILABLE,
            source = source,
            availability = availability,
            timestamp = at,
            notes = notes,
        )
    }
}

data class SimInfo(
    val slot: Int,
    val carrier: String?,
    val rat: String?,
    val roaming: Boolean?,
    val active: Boolean?,
)

data class DeviceInfo(
    val manufacturer: String?,
    val model: String?,
    val osVersion: String?,
    val sdkInt: Int?,
)

data class AppInfo(
    val name: String = "PhoneCare Android",
    val version: String = "0.1.0",
    val build: String? = "prototype",
)

data class NetworkInfo(
    val transport: String,
    val carrier: String?,
    val server: String?,
    val sims: List<SimInfo> = emptyList(),
)

data class SessionInfo(
    val startedAt: Instant,
    val durationMs: Long,
    val trigger: String,
)

data class DiagnosticReport(
    val id: String,
    val generatedAt: Instant,
    val app: AppInfo,
    val device: DeviceInfo,
    val session: SessionInfo,
    val network: NetworkInfo,
    val measurements: List<Measurement>,
    val limitations: List<String>,
) {
    init {
        require(id.isNotBlank() && id.length <= 64)
        require(measurements.size <= 400) { "at most 400 measurements" }
        require(limitations.isNotEmpty()) { "a report must state its limitations" }
        require(network.transport in setOf("wifi", "cellular", "ethernet", "unknown"))
        require(session.trigger in setOf("manual", "scheduled", "survey"))
    }

    companion object {
        const val SCHEMA_VERSION = "phonecare.report/1"
    }
}
