import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.MeasureUnit
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.core.AppInfo
import app.phonecare.diagnostics.core.DeviceInfo
import app.phonecare.diagnostics.core.NetworkInfo
import app.phonecare.diagnostics.core.SessionInfo
import app.phonecare.diagnostics.optimization.TipInput
import app.phonecare.diagnostics.optimization.tips
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.survey.SurveySession
import java.time.Instant
import kotlin.system.exitProcess

/**
 * Executable checks for the Android measurement engine.
 *
 * These run on a desktop JVM against the same sources the app compiles (plus the
 * Android SDK's android.jar for type resolution). They prove the schema
 * invariants, the statistics and the guidance rules — not device behaviour.
 *
 * Run with native/android/verify-engine.sh.
 */

private var passed = 0
private val failures = mutableListOf<String>()

private fun check(name: String, condition: Boolean, detail: String = "") {
    if (condition) {
        passed += 1
    } else {
        failures += "$name${if (detail.isNotEmpty()) " — $detail" else ""}"
    }
}

private fun sample(index: Int, rtt: Double?) =
    InternetQualityEngine.ProbeSample(index, rtt, InternetQualityEngine.Failure.NONE, Instant.parse("2026-11-09T10:00:00Z"))

fun main() {
    val at = Instant.parse("2026-11-09T10:00:00Z")

    // --- schema invariants -------------------------------------------------
    val nullMeasured = runCatching {
        Measurement(
            id = "lte.rsrp",
            label = "LTE RSRP",
            value = null,
            unit = MeasureUnit.DBM,
            evidence = Evidence.MEASURED,
            source = "test",
            availability = Availability.TRANSIENT,
            timestamp = at,
        )
    }
    check("null value cannot be marked measured", nullMeasured.isFailure)

    val unavailable = Measurement.unavailable(
        id = "nr.ss_rsrp",
        label = "5G NR SS-RSRP",
        unit = MeasureUnit.DBM,
        source = "CellSignalStrengthNr",
        availability = Availability.UNSUPPORTED,
        at = at,
    )
    check("unavailable helper yields null value", unavailable.value == null)
    check("unavailable helper keeps the reason", unavailable.availability == Availability.UNSUPPORTED)

    val measured = Measurement(
        id = "lte.rsrp",
        label = "LTE RSRP",
        value = -97.0,
        unit = MeasureUnit.DBM,
        evidence = Evidence.MEASURED,
        source = "CellSignalStrengthLte.getRsrp()",
        availability = Availability.AVAILABLE,
        timestamp = at,
        sampleCount = 1,
    )
    check("measured row keeps its value", measured.value == -97.0)

    val reportWithoutLimits = runCatching {
        DiagnosticReport(
            id = "r1",
            generatedAt = at,
            app = AppInfo(),
            device = DeviceInfo(null, null, null, null),
            session = SessionInfo(at, 1000, "manual"),
            network = NetworkInfo("cellular", null, null),
            measurements = listOf(measured),
            limitations = emptyList(),
        )
    }
    check("a report without limitations is rejected", reportWithoutLimits.isFailure)

    // --- probe statistics --------------------------------------------------
    val probes = listOf(90.0, 50.0, 40.0, 60.0, 50.0).mapIndexed { index, rtt -> sample(index, rtt) }
    val summary = InternetQualityEngine.summarise(probes)
    check("median excludes the cold probe", summary.medianMs == 50.0, summary.medianMs.toString())
    check("minimum distance", summary.minMs == 40.0, summary.minMs.toString())
    check("jitter is mean absolute difference", summary.jitterMs?.let { kotlin.math.abs(it - 13.333) < 0.01 } == true, summary.jitterMs.toString())
    check("no failures counted", summary.failures == 0)

    val withFailures = listOf(sample(0, 50.0), sample(1, null), sample(2, null))
    val failureSummary = InternetQualityEngine.summarise(withFailures)
    check("failures are counted", failureSummary.failures == 2)
    check("failure rate is a percentage", kotlin.math.round(failureSummary.failureRatePct) == 67.0)

    // --- stability and scoring --------------------------------------------
    val stable = InternetQualityEngine.stability(listOf(52.0, 55.0, 51.0))
    check("tight rounds are stable", stable.label == "stable", stable.label)

    val tinyAbsoluteDrift = InternetQualityEngine.stability(listOf(9.0, 11.0, 18.0))
    check("under 20 ms drift stays stable even with a high CV", tinyAbsoluteDrift.label == "stable", "${tinyAbsoluteDrift.label} cv=${tinyAbsoluteDrift.cvPct}")

    val unstable = InternetQualityEngine.stability(listOf(20.0, 200.0, 400.0))
    check("large swings are unstable", unstable.label == "unstable", unstable.label)

    val withheld = InternetQualityEngine.score(summary, 50.0, 20.0, stable.cvPct, stable.rangeMs, scored = false)
    check("score is withheld when validity fails", withheld["total"] == null)

    val scored = InternetQualityEngine.score(summary, 50.0, 20.0, stable.cvPct, stable.rangeMs, scored = true)
    check("score is published when validity passes", (scored["total"] ?: 0.0) > 80.0, scored.toString())

    // --- guidance ----------------------------------------------------------
    val baseInput = TipInput(
        transport = "wifi",
        wifiRssiDbm = -55.0,
        wifiBand = "5 GHz",
        cellularRsrpDbm = -90.0,
        cellularRat = "LTE",
        latencyMedianMs = 45.0,
        jitterMs = 8.0,
        failureRatePct = 0.0,
        dnsMs = 20.0,
        downloadMbps = 40.0,
        gatewayReachable = true,
        surveyBestRoom = null,
        surveyBestScore = null,
        surveyWorstRoom = null,
        surveyWorstScore = null,
    )
    val weakWifi = tips(baseInput.copy(wifiRssiDbm = -80.0))
    check("weak Wi-Fi produces a placement tip", weakWifi.any { it.id == "wifi-weak" })

    val upstream = tips(baseInput.copy(wifiRssiDbm = -52.0, latencyMedianMs = 220.0))
    check("strong Wi-Fi with slow path is treated as upstream", upstream.any { it.id == "upstream" })

    val weakCell = tips(baseInput.copy(transport = "cellular", cellularRsrpDbm = -112.0, wifiRssiDbm = null))
    check("weak cellular mentions Wi-Fi Calling", weakCell.any { it.id == "wifi-calling" })
    check("weak cellular does not promise amplification", weakCell.none { it.detail.contains("boost your signal", ignoreCase = true) })

    val roomGap = tips(baseInput.copy(surveyBestRoom = "Window", surveyBestScore = 90.0, surveyWorstRoom = "Bedroom", surveyWorstScore = 50.0))
    check("room gap produces a location tip", roomGap.any { it.id == "room-gap" })

    val nothing = tips(baseInput)
    check("healthy input reports no fault", nothing.any { it.id == "no-fault" })
    check("every answer states the product boundary", nothing.last().id == "limits")

    // --- survey classification --------------------------------------------
    check("RSRP band excellent", SurveySession.classifyRsrp(-75.0) == "Excellent")
    check("RSRP band fair", SurveySession.classifyRsrp(-95.0) == "Fair")
    check("RSRP band very weak", SurveySession.classifyRsrp(-115.0) == "Very weak")
    check("RSSI band weak", SurveySession.classifyRssi(-78.0) == "Weak")

    println("native engine checks: $passed passed, ${failures.size} failed")
    if (failures.isNotEmpty()) {
        failures.forEach { println("  x $it") }
        exitProcess(1)
    }
}
