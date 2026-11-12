package app.phonecare.diagnostics

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.phonecare.diagnostics.cellular.CellularCollector
import app.phonecare.diagnostics.core.AppInfo
import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.MeasureUnit
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.NetworkInfo
import app.phonecare.diagnostics.core.SessionInfo
import app.phonecare.diagnostics.core.Uncertainty
import app.phonecare.diagnostics.net.ConnectivityMonitor
import app.phonecare.diagnostics.optimization.TipInput
import app.phonecare.diagnostics.optimization.tips
import app.phonecare.diagnostics.permissions.PermissionManager
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.report.ReportExporter
import app.phonecare.diagnostics.survey.SurveySession
import app.phonecare.diagnostics.wifi.WifiCollector
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Plain-framework UI (no Compose, no AndroidX).
 *
 * Why no Compose: the measurement engine only needs the Android framework, and a
 * prototype that depends on nothing but the SDK is far easier to build, audit and
 * install. Every network operation runs on a background executor; the UI thread
 * never blocks on a socket.
 */
class MainActivity : Activity() {

    private lateinit var permissionManager: PermissionManager
    private val cellularCollector by lazy { CellularCollector(applicationContext) }
    private val wifiCollector by lazy { WifiCollector(applicationContext) }
    private val surveySession by lazy { SurveySession(applicationContext) }
    private val exporter by lazy { ReportExporter(applicationContext) }
    private val worker = Executors.newSingleThreadExecutor()
    private val sessionStarted: Instant = Instant.now()

    private lateinit var content: LinearLayout
    private lateinit var statusView: TextView
    private lateinit var cellularOutput: TextView
    private lateinit var wifiOutput: TextView
    private lateinit var qualityOutput: TextView
    private lateinit var guidanceOutput: TextView
    private lateinit var surveyOutput: TextView
    private lateinit var roomButtons: LinearLayout
    private lateinit var serverInput: EditText
    private lateinit var roomInput: EditText
    private lateinit var dbmInput: EditText

    private var cellular: CellularCollector.Snapshot? = null
    private var wifi: WifiCollector.Snapshot? = null
    private var quality: InternetQualityEngine.Result? = null
    private var connectivity: ConnectivityMonitor.Events? = null
    private var survey: SurveySession.Survey = SurveySession.Survey(Instant.now(), emptyList())
    private val ratHistory = mutableListOf<String>()

    /** Guards against overlapping measurements (double taps during device testing). */
    @Volatile
    private var runInProgress = false
    private var activeMonitor: ConnectivityMonitor? = null
    private var completedRuns = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permissionManager = PermissionManager(this)
        survey = surveySession.load()

        val scroll = ScrollView(this)
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(32))
        }
        scroll.addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(scroll)

        buildUi()
        refreshCellularCard()
        refreshWifiCard()
        renderSurvey()
        renderGuidance()
    }

    override fun onDestroy() {
        // A measurement in flight must not leave a registered NetworkCallback behind.
        activeMonitor?.stop()
        activeMonitor = null
        worker.shutdownNow()
        super.onDestroy()
    }

    // ------------------------------------------------------------------ UI

    private fun buildUi() {
        title("PhoneCare Diagnostics")
        body("Measurements carry their source. If a reading is unavailable it stays empty — nothing is invented. " +
            "Network work runs off the UI thread; a full quality test takes about half a minute.")

        // Cellular
        val cellularSection = section("Cellular signal", "Modem-reported RSRP / RSRQ / SINR, network type and SIM state.")
        cellularOutput = body("Not read yet.")
        cellularSection.addView(cellularOutput)
        cellularSection.addView(button("Read cellular now") { readCellular() })
        cellularSection.addView(button("Permission details") { showPermissionDialog() })
        content.addView(cellularSection)

        // Wi-Fi
        val wifiSection = section("Wi-Fi link", "Connected access point only. No scanning, no passwords.")
        wifiOutput = body("Not read yet.")
        wifiSection.addView(wifiOutput)
        wifiSection.addView(button("Read Wi-Fi now") { refreshWifiCard() })
        content.addView(wifiSection)

        // Quality
        val qualitySection = section("Internet quality", "Median/minimum RTT, jitter, probe failures, DNS and directional throughput.")
        serverInput = EditText(this).apply {
            setText("https://phonecare.app")
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            hint = "Test server base URL"
        }
        qualitySection.addView(serverInput)
        qualitySection.addView(body("The deployment must expose /api/network/ping, /download and /upload. Distance to this server is part of every result."))
        qualityOutput = body("Not run yet.")
        qualitySection.addView(qualityOutput)
        qualitySection.addView(button("Run quality test") { runQualityTest() })
        content.addView(qualitySection)

        // Guidance
        val guidanceSection = section("Guided next steps", "Rules only fire when the reading that justifies them exists.")
        guidanceOutput = body("")
        guidanceSection.addView(guidanceOutput)
        guidanceSection.addView(button("Open network settings") { permissionManager.openNetworkSettings() })
        guidanceSection.addView(button("Open Wi-Fi Calling settings") { permissionManager.openWifiCallingSettings() })
        content.addView(guidanceSection)

        // Survey
        val surveySection = section("Indoor survey", "Room names are typed by you. Location is never requested.")
        roomInput = EditText(this).apply { hint = "Room name" }
        surveySection.addView(roomInput)
        surveySection.addView(button("Add room") { addRoom() })
        dbmInput = EditText(this).apply {
            hint = "Optional dBm you read elsewhere (e.g. -104)"
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
        }
        surveySection.addView(dbmInput)
        surveySection.addView(body("Entered dBm values are stored as your input, not as a measurement."))
        surveyOutput = body("")
        surveySection.addView(surveyOutput)
        roomButtons = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        surveySection.addView(roomButtons)
        content.addView(surveySection)

        // Report
        val reportSection = section("Report", "Same contract as the website: phonecare.report/1.")
        reportSection.addView(button("Share JSON report") { shareReport() })
        content.addView(reportSection)

        statusView = body("")
        statusView.setTypeface(Typeface.DEFAULT_BOLD)
        content.addView(statusView)
    }

    private fun section(title: String, subtitle: String): LinearLayout {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(16) }
        }
        box.addView(TextView(this).apply {
            text = title
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
        })
        box.addView(TextView(this).apply {
            text = subtitle
            textSize = 12f
            setPadding(0, dp(4), 0, dp(8))
        })
        return box
    }

    private fun title(text: String) {
        content.addView(TextView(this).apply {
            this.text = text
            textSize = 24f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, 0, 0, dp(8))
        })
    }

    private fun body(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 13f
        setPadding(0, dp(4), 0, dp(4))
    }

    private fun button(label: String, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        setOnClickListener { onClick() }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun setStatus(message: String) {
        statusView.text = message
    }

    // --------------------------------------------------------- cellular

    private fun hasCellularPermissions(): Boolean =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun showPermissionDialog() {
        val locationState = permissionManager.state(Manifest.permission.ACCESS_FINE_LOCATION)
        val phoneState = permissionManager.state(Manifest.permission.READ_PHONE_STATE)
        when {
            locationState == PermissionManager.State.PERMANENTLY_DENIED || phoneState == PermissionManager.State.PERMANENTLY_DENIED -> {
                setStatus("Access was permanently denied. Android will not show the dialog again; open app settings to change it.")
                permissionManager.openAppSettings()
            }
            hasCellularPermissions() -> setStatus("Location and phone-state access are already granted.")
            else -> setStatus(
                PermissionManager.rationale(Manifest.permission.ACCESS_FINE_LOCATION) + "\n\n" +
                    PermissionManager.rationale(Manifest.permission.READ_PHONE_STATE),
            )
        }
    }

    private fun readCellular() {
        if (!hasCellularPermissions()) {
            showPermissionDialog()
            requestPermissions(PermissionManager.CELLULAR_PERMISSIONS, PermissionManager.REQUEST_LOCATION)
            return
        }
        setStatus("Reading the serving cell…")
        worker.execute {
            val snapshot = cellularCollector.collect()
            runOnUiThread {
                cellular = snapshot
                renderCellular()
                renderGuidance()
                setStatus("Cellular readings refreshed. Radio values are modem-reported and can be stale.")
            }
        }
    }

    private fun refreshCellularCard() {
        renderCellular()
    }

    private fun renderCellular() {
        val snapshot = cellular
        if (snapshot == null) {
            cellularOutput.text = "Not read yet. Reading requires location and phone-state access."
            return
        }
        val lines = mutableListOf<String>()
        lines += "Carrier: ${snapshot.carrier ?: "unknown"} · SIMs: ${snapshot.sims.size}"
        snapshot.sims.forEach { sim ->
            lines += "Slot ${sim.slot}: ${sim.carrier ?: "unknown"} · ${sim.rat ?: "unknown"} · roaming ${sim.roaming ?: "?"}"
        }
        snapshot.measurements.forEach { measurement ->
            lines += "${measurement.label}: ${measurement.value?.let { "%.1f".format(it) } ?: "unavailable"} ${measurement.unit.json}"
        }
        if (snapshot.rat != null) {
            ratHistory.add(0, "${Instant.now()} ${snapshot.rat} ${snapshot.rsrpDbm?.let { "${"%.0f".format(it)} dBm" } ?: ""}")
            while (ratHistory.size > 5) ratHistory.removeAt(ratHistory.size - 1)
            lines += ""
            lines += "Recent radio access technology:"
            ratHistory.forEach { lines += "· $it" }
        }
        lines += ""
        snapshot.notes.forEach { lines += "· $it" }
        cellularOutput.text = lines.joinToString("\n")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PermissionManager.REQUEST_LOCATION) return
        permissions.forEachIndexed { index, permission ->
            permissionManager.onResult(permission, grantResults.getOrNull(index) == android.content.pm.PackageManager.PERMISSION_GRANTED)
        }
        if (hasCellularPermissions()) {
            readCellular()
        } else {
            setStatus("Permission denied. The cellular card stays empty by design; link and Wi-Fi tests still work.")
            renderCellular()
        }
    }

    // ------------------------------------------------------------- wifi

    private fun refreshWifiCard() {
        worker.execute {
            val snapshot = wifiCollector.collect()
            runOnUiThread {
                wifi = snapshot
                renderWifi()
                renderGuidance()
            }
        }
    }

    private fun renderWifi() {
        val snapshot = wifi ?: return
        val lines = mutableListOf<String>()
        lines += "Connected: ${snapshot.connected} · SSID: ${snapshot.ssid ?: "hidden"} · band: ${snapshot.band ?: "unknown"}"
        lines += "Gateway: ${snapshot.gateway ?: "not reported"} · DNS: ${snapshot.dnsServers.joinToString().ifEmpty { "not reported" }}"
        snapshot.measurements.forEach { measurement ->
            lines += "${measurement.label}: ${measurement.value?.let { "%.0f".format(it) } ?: "unavailable"} ${measurement.unit.json}"
        }
        lines += ""
        snapshot.notes.forEach { lines += "· $it" }
        wifiOutput.text = lines.joinToString("\n")
    }

    // ---------------------------------------------------------- quality

    private fun runQualityTest() {
        val baseUrl = serverInput.text.toString().trim().trimEnd('/')
        if (!baseUrl.startsWith("http")) {
            setStatus("Enter an http(s) test server first.")
            return
        }
        if (runInProgress) {
            setStatus("A measurement is already running. Wait for it to finish — overlapping runs would mix samples.")
            return
        }
        runInProgress = true
        val gateway = wifi?.gateway
        setStatus("Running the quality test…")
        qualityOutput.text = "Measuring latency, throughput and stability. Keep the screen on."
        worker.execute {
            val monitor = ConnectivityMonitor(applicationContext)
            activeMonitor = monitor
            monitor.start()
            try {
                val result = runCatching {
                    InternetQualityEngine(baseUrl).run({ message ->
                        runOnUiThread { qualityOutput.text = message }
                    }, gatewayHost = gateway)
                }
                val events = monitor.stop()
                activeMonitor = null
                runOnUiThread {
                    result.onSuccess { value ->
                        quality = value
                        connectivity = events
                        completedRuns += 1
                        renderQuality()
                        renderGuidance()
                        setStatus(
                            if (value.scored) {
                                "Run #$completedRuns complete."
                            } else {
                                "Run #$completedRuns finished, but no score was published: " +
                                    value.validityReasons.joinToString("; ")
                            },
                        )
                    }.onFailure { error ->
                        qualityOutput.text = "The test failed: ${error.javaClass.simpleName}."
                        setStatus("The quality test did not complete.")
                    }
                }
            } finally {
                runOnUiThread { runInProgress = false }
            }
        }
    }

    private fun renderQuality() {
        val result = quality ?: return
        val lines = mutableListOf<String>()
        lines += "Server: ${result.server ?: "not set"}"
        lines += "Median ${fmt(result.latency.medianMs, "ms")} · min ${fmt(result.latency.minMs, "ms")} · jitter ${fmt(result.latency.jitterMs, "ms")}"
        lines += "Failures ${"%.1f".format(result.latency.failureRatePct)} % · samples ${result.latency.succeeded}/${result.latency.attempted}"
        lines += "Download ${fmt(result.download?.mbps, "Mbps")} · upload ${fmt(result.upload?.mbps, "Mbps")}"
        lines += "DNS ${fmt(result.dnsMs, "ms")} · stability ${result.stability.label}${result.stability.rangeMs?.let { " (${"%.0f".format(it)} ms spread)" } ?: ""}"
        lines += "Link index: ${result.scores["total"]?.toInt() ?: "withheld"}"
        result.gateway?.let { probe ->
            lines += if (probe.reachable) {
                "Gateway ${probe.host} answered TCP on port ${probe.port} in ${probe.connectMs} ms"
            } else {
                "Gateway ${probe.host}: no TCP answer on 53/80/443 (inconclusive)"
            }
            lines += "· ${probe.note}"
        }
        connectivity?.let { events ->
            lines += "Network transitions during the test: ${events.available} available · ${events.lost} lost · ${events.capabilityChanges} capability changes"
            lines += "· The first callback usually describes the already-connected network, so the counts include a baseline."
        }
        lines += ""
        result.limitations.forEach { lines += "· $it" }
        qualityOutput.text = lines.joinToString("\n")
    }

    private fun fmt(value: Double?, unit: String): String =
        if (value == null) "— $unit" else "${"%.1f".format(value)} $unit"

    // --------------------------------------------------------- guidance

    private fun renderGuidance() {
        val input = TipInput(
            transport = if (wifi?.connected == true) "wifi" else "cellular",
            wifiRssiDbm = wifi?.measurements?.firstOrNull { it.id == "wifi.rssi" }?.value,
            wifiBand = wifi?.band,
            cellularRsrpDbm = cellular?.rsrpDbm,
            cellularRat = cellular?.rat,
            latencyMedianMs = quality?.latency?.medianMs,
            jitterMs = quality?.latency?.jitterMs,
            failureRatePct = quality?.latency?.failureRatePct,
            dnsMs = quality?.dnsMs,
            downloadMbps = quality?.download?.mbps,
            gatewayReachable = quality?.gateway?.reachable,
            surveyBestRoom = bestRoom()?.first,
            surveyBestScore = bestRoom()?.second,
            surveyWorstRoom = worstRoom()?.first,
            surveyWorstScore = worstRoom()?.second,
        )
        guidanceOutput.text = tips(input).joinToString("\n\n") { tip ->
            "${tip.title}\n${tip.detail}\nEvidence: ${tip.evidence.joinToString(" · ")}"
        }
    }

    private fun bestRoom(): Pair<String, Double>? =
        survey.rooms
            .mapNotNull { room -> surveySession.summarise(room).score?.let { room.name to it } }
            .maxByOrNull { it.second }

    private fun worstRoom(): Pair<String, Double>? =
        survey.rooms
            .mapNotNull { room -> surveySession.summarise(room).score?.let { room.name to it } }
            .minByOrNull { it.second }

    // ----------------------------------------------------------- survey

    private fun addRoom() {
        val name = roomInput.text.toString()
        survey = surveySession.addRoom(survey, name)
        roomInput.setText("")
        renderSurvey()
    }

    private fun renderSurvey() {
        val lines = mutableListOf<String>()
        if (survey.rooms.isEmpty()) {
            lines += "No rooms yet."
        }
        survey.rooms.forEach { room ->
            val summary = surveySession.summarise(room)
            lines += "${room.name} — score ${summary.score?.toInt() ?: "—"} / 100 · ${summary.sampleCount} samples · ${summary.confidence} confidence"
            lines += "  ${summary.note}"
            if (summary.userDbmMedian != null) {
                lines += "  Your dBm input: ${"%.0f".format(summary.userDbmMedian)} (${SurveySession.classifyRsrp(summary.userDbmMedian)})"
            }
        }
        surveyOutput.text = lines.joinToString("\n")

        // Room buttons live in their own container so re-rendering never removes
        // the text view or the inputs.
        roomButtons.removeAllViews()
        survey.rooms.forEach { room ->
            roomButtons.addView(button("Measure ${room.name} (5 probes)") { measureRoom(room.id) })
        }
    }

    private fun measureRoom(roomId: String) {
        val baseUrl = serverInput.text.toString().trim().trimEnd('/')
        if (!baseUrl.startsWith("http")) {
            setStatus("Enter an http(s) test server first.")
            return
        }
        if (runInProgress) {
            setStatus("A measurement is already running. Wait for it to finish before measuring a room.")
            return
        }
        runInProgress = true
        setStatus("Measuring the room…")
        worker.execute {
            val result = runCatching { InternetQualityEngine(baseUrl).run() }
            val sample = result.getOrNull()
            runOnUiThread {
                runInProgress = false
                if (sample == null) {
                    setStatus("The room measurement failed.")
                } else {
                    survey = surveySession.addSample(surveySession.load(), roomId, sample.samples, dbmInput.text.toString().toDoubleOrNull())
                    renderSurvey()
                    renderGuidance()
                    setStatus("Sample added. Three samples are required before a room is scored.")
                }
            }
        }
    }

    // ----------------------------------------------------------- report

    private fun shareReport() {
        val report = assembleReport()
        val intent = exporter.shareIntent(report)
        startActivity(Intent.createChooser(intent, "Share PhoneCare report"))
        setStatus("Report prepared. It contains only what was measured in this session.")
    }

    private fun assembleReport(): DiagnosticReport {
        val at = Instant.now()
        val measurements = mutableListOf<Measurement>()
        cellular?.measurements?.let { measurements += it }
        wifi?.measurements?.let { measurements += it }

        quality?.let { result ->
            result.latency.medianMs?.let { median ->
                measurements += Measurement(
                    id = "net.latency.median",
                    label = "Median round-trip latency",
                    value = median,
                    unit = MeasureUnit.MS,
                    evidence = Evidence.MEASURED,
                    source = "${result.latency.attempted} HTTPS probes",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    uncertainty = result.latency.spreadMs?.let { Uncertainty(Uncertainty.Kind.SAMPLE_SPREAD, it, "ms") },
                    sampleCount = result.latency.succeeded.takeIf { it > 0 },
                )
            }
            result.latency.jitterMs?.let { jitter ->
                measurements += Measurement(
                    id = "net.latency.jitter",
                    label = "Jitter",
                    value = jitter,
                    unit = MeasureUnit.MS,
                    evidence = Evidence.MEASURED,
                    source = "Mean absolute difference between consecutive probes",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                )
            }
            measurements += Measurement(
                id = "net.probe.failure_rate",
                label = "Probe failure rate",
                value = result.latency.failureRatePct,
                unit = MeasureUnit.PERCENT,
                evidence = Evidence.MEASURED,
                source = "HTTP probe outcomes (not packet loss)",
                availability = Availability.AVAILABLE,
                timestamp = at,
                sampleCount = result.latency.attempted,
            )
            result.dnsMs?.let { dns ->
                measurements += Measurement(
                    id = "net.dns.lookup_time",
                    label = "DNS lookup time",
                    value = dns,
                    unit = MeasureUnit.MS,
                    evidence = Evidence.MEASURED,
                    source = "InetAddress.getAllByName",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                )
            }
            result.download?.let { transfer ->
                measurements += Measurement(
                    id = "net.download.mbps",
                    label = "Download throughput",
                    value = transfer.mbps,
                    unit = MeasureUnit.MBPS,
                    evidence = Evidence.MEASURED,
                    source = "HTTP transfer from the configured test server",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    context = mapOf("bytes" to transfer.bytes.toString(), "durationMs" to transfer.ms.toString()),
                )
            }
            result.upload?.let { transfer ->
                measurements += Measurement(
                    id = "net.upload.mbps",
                    label = "Upload throughput",
                    value = transfer.mbps,
                    unit = MeasureUnit.MBPS,
                    evidence = Evidence.MEASURED,
                    source = "HTTP transfer to the configured test server",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    context = mapOf("bytes" to transfer.bytes.toString(), "durationMs" to transfer.ms.toString()),
                )
            }
            result.gateway?.let { probe ->
                measurements += Measurement(
                    id = "wifi.gateway_tcp",
                    label = "Gateway TCP probe",
                    value = if (probe.reachable) 1.0 else 0.0,
                    unit = MeasureUnit.COUNT,
                    evidence = Evidence.MEASURED,
                    source = "TCP connect to the default gateway",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    context = mapOf("port" to probe.port.toString(), "host" to probe.host),
                    notes = listOf(probe.note, "1 = a TCP service answered; 0 = no answer, which does not prove the gateway is down."),
                )
            }
        }

        connectivity?.let { events ->
            measurements += Measurement(
                id = "net.connectivity_events",
                label = "Network transitions during the test",
                value = events.lost.toDouble(),
                unit = MeasureUnit.COUNT,
                evidence = Evidence.MEASURED,
                source = "ConnectivityManager.NetworkCallback",
                availability = Availability.AVAILABLE,
                timestamp = at,
                context = mapOf(
                    "available" to events.available.toString(),
                    "capabilityChanges" to events.capabilityChanges.toString(),
                ),
                notes = listOf("Counts include the initial callback for the already-connected network."),
            )
        }

        val limitations = buildList {
            add("Cellular values are reported by the modem and may be stale; Android throttles cell queries for power.")
            add("Wi-Fi RSSI is quantised by the driver and describes the link to the access point, not the internet.")
            add("A single test describes a moment, not the connection.")
            add("This app cannot boost, amplify or repair a signal, and it never changes your settings.")
            quality?.limitations?.let { addAll(it) }
            cellular?.notes?.let { addAll(it) }
        }

        return DiagnosticReport(
            id = UUID.randomUUID().toString(),
            generatedAt = at,
            app = AppInfo(),
            device = ReportExporter.deviceInfo(),
            session = SessionInfo(
                startedAt = sessionStarted,
                durationMs = java.time.Duration.between(sessionStarted, at).toMillis(),
                trigger = "manual",
            ),
            network = NetworkInfo(
                transport = when {
                    wifi?.connected == true -> "wifi"
                    cellular != null -> "cellular"
                    else -> "unknown"
                },
                carrier = cellular?.carrier,
                server = quality?.server,
                sims = cellular?.sims ?: emptyList(),
            ),
            measurements = measurements,
            limitations = limitations,
        )
    }
}
