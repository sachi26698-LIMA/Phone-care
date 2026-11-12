package app.phonecare.diagnostics

import android.Manifest
import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.phonecare.diagnostics.cellular.CellularCollector
import app.phonecare.diagnostics.core.AppInfo
import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.NetworkInfo
import app.phonecare.diagnostics.core.SessionInfo
import app.phonecare.diagnostics.core.Unit
import app.phonecare.diagnostics.core.Uncertainty
import app.phonecare.diagnostics.permissions.PermissionManager
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.report.ReportExporter
import app.phonecare.diagnostics.survey.SurveySession
import app.phonecare.diagnostics.wifi.WifiCollector
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface { DiagnosticScreen() }
            }
        }
    }
}

@Composable
private fun DiagnosticScreen() {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    val permissionManager = remember(activity) { activity?.let { PermissionManager(it) } }
    val cellularCollector = remember { CellularCollector(context.applicationContext) }
    val wifiCollector = remember { WifiCollector(context.applicationContext) }
    val surveySession = remember { SurveySession(context.applicationContext) }
    val exporter = remember { ReportExporter(context.applicationContext) }

    var permissionTick by remember { mutableIntStateOf(0) }
    var cellular by remember { mutableStateOf<CellularCollector.Snapshot?>(null) }
    var wifi by remember { mutableStateOf<WifiCollector.Snapshot?>(null) }
    var quality by remember { mutableStateOf<InternetQualityEngine.Result?>(null) }
    var survey by remember { mutableStateOf<SurveySession.Survey?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var showRationale by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf("https://phonecare.app") }
    var roomName by remember { mutableStateOf("") }
    var manualDbm by remember { mutableStateOf("") }
    val sessionStarted = remember { Instant.now() }

    val locationState = permissionManager?.state(Manifest.permission.ACCESS_FINE_LOCATION)
    val phoneState = permissionManager?.state(Manifest.permission.READ_PHONE_STATE)

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        results.forEach { (permission, granted) -> permissionManager?.onResult(permission, granted) }
        permissionTick += 1
        if (results.values.all { it }) {
            cellular = cellularCollector.collect()
        } else {
            status = "Some permissions were denied. The affected card explains what is missing and keeps a manual fallback."
        }
    }

    LaunchedEffect(permissionTick) {
        wifi = wifiCollector.collect()
        survey = surveySession.load()
    }

    Column(
        modifier = Modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("PhoneCare Diagnostics", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Measurements are labelled with their source. Unavailable readings stay empty — this app never invents a signal value.",
            style = MaterialTheme.typography.bodySmall,
        )

        SectionCard(
            title = "Cellular signal",
            subtitle = "Modem-reported RSRP / RSRQ / SINR, network type and SIM state.",
        ) {
            val granted = locationState == PermissionManager.State.GRANTED && phoneState == PermissionManager.State.GRANTED
            when {
                granted -> {
                    Button(onClick = {
                        cellular = cellularCollector.collect()
                        status = "Cellular readings refreshed."
                    }) { Text("Read cellular now") }
                    cellular?.let { CellularReadout(it) }
                }
                locationState == PermissionManager.State.PERMANENTLY_DENIED || phoneState == PermissionManager.State.PERMANENTLY_DENIED -> {
                    Text("Access was permanently denied. Android will not show the dialog again.")
                    Button(onClick = { permissionManager?.openAppSettings() }) { Text("Open app settings") }
                }
                else -> {
                    Text(PermissionManager.rationale(Manifest.permission.ACCESS_FINE_LOCATION))
                    Text(PermissionManager.rationale(Manifest.permission.READ_PHONE_STATE))
                    Button(onClick = { showRationale = true }) { Text("Review and allow") }
                }
            }
        }

        SectionCard(
            title = "Wi-Fi link",
            subtitle = "Connected access point only. No scanning, no site survey, no passwords.",
        ) {
            Button(onClick = {
                wifi = wifiCollector.collect()
                status = "Wi-Fi readings refreshed."
            }) { Text("Read Wi-Fi now") }
            wifi?.let { WifiReadout(it) }
        }

        SectionCard(
            title = "Internet quality",
            subtitle = "Median/minimum RTT, jitter, probe failures, DNS and directional throughput.",
        ) {
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Test server base URL") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "The deployment must expose /api/network/ping, /download and /upload. Distance to this server is part of every throughput result.",
                style = MaterialTheme.typography.bodySmall,
            )
            Button(
                enabled = busy == null && serverUrl.startsWith("http"),
                onClick = {
                    busy = "Running the quality test"
                    scope.launch {
                        try {
                            quality = InternetQualityEngine(serverUrl.trimEnd('/')).run { message -> busy = message }
                            status = quality?.let { result ->
                                if (result.scored) "Quality test complete." else
                                    "Test complete, but no score was published: ${result.validityReasons.joinToString("; ")}"
                            }
                        } catch (error: Exception) {
                            status = "The quality test failed: ${error.javaClass.simpleName}."
                        } finally {
                            busy = null
                        }
                    }
                },
            ) { Text(if (quality == null) "Run quality test" else "Run again") }
            busy?.let { message ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.height(16.dp))
                    Text(message, style = MaterialTheme.typography.bodySmall)
                }
            }
            quality?.let { QualityReadout(it) }
        }

        SectionCard(
            title = "Indoor survey",
            subtitle = "Room names are typed by you. Location is never requested.",
        ) {
            val current = survey
            if (current == null) {
                Text("Loading…")
            } else {
                OutlinedTextField(
                    value = roomName,
                    onValueChange = { roomName = it },
                    label = { Text("Room name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        enabled = roomName.isNotBlank(),
                        onClick = {
                            survey = surveySession.addRoom(current, roomName)
                            roomName = ""
                        },
                    ) { Text("Add room") }
                }
                OutlinedTextField(
                    value = manualDbm,
                    onValueChange = { manualDbm = it },
                    label = { Text("Optional dBm you read elsewhere") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Entered dBm values are stored as your input, not as a measurement.",
                    style = MaterialTheme.typography.bodySmall,
                )

                current.rooms.forEach { room ->
                    val summary = surveySession.summarise(room)
                    HorizontalDivider()
                    Text(room.name, style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Score: ${summary.score?.toInt() ?: "—"} · samples ${summary.sampleCount} · ${summary.confidence} confidence",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(summary.note, style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            enabled = busy == null && serverUrl.startsWith("http"),
                            onClick = {
                                busy = "Measuring ${room.name}"
                                scope.launch {
                                    try {
                                        val engine = InternetQualityEngine(serverUrl.trimEnd('/'))
                                        val result = engine.run()
                                        val dbm = manualDbm.toDoubleOrNull()
                                        survey = surveySession.addSample(
                                            surveySession.load(),
                                            room.id,
                                            result.samples,
                                            dbm,
                                        )
                                        status = "Sample added to ${room.name}."
                                    } catch (error: Exception) {
                                        status = "The sample failed: ${error.javaClass.simpleName}."
                                    } finally {
                                        busy = null
                                    }
                                }
                            },
                        ) { Text("Take 5 probes") }
                        TextButton(onClick = { survey = surveySession.removeRoom(surveySession.load(), room.id) }) {
                            Text("Remove")
                        }
                    }
                }
                if (current.rooms.isEmpty()) Text("No rooms yet.")
            }
        }

        SectionCard(
            title = "Report",
            subtitle = "Same contract as the website: phonecare.report/1.",
        ) {
            Text(
                "Cellular and Wi-Fi readings above are included when you have taken them. Missing sections are marked unavailable rather than omitted silently.",
                style = MaterialTheme.typography.bodySmall,
            )
            Button(
                onClick = {
                    val report = assembleReport(
                        cellular = cellular,
                        wifi = wifi,
                        quality = quality,
                        startedAt = sessionStarted,
                    )
                    runCatching {
                        val intent = exporter.shareIntent(report)
                        context.startActivity(android.content.Intent.createChooser(intent, "Share report"))
                    }.onFailure { status = "The report could not be exported: ${it.javaClass.simpleName}." }
                },
            ) { Text("Export JSON report") }
        }

        status?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }

    if (showRationale) {
        AlertDialog(
            onDismissRequest = { showRationale = false },
            title = { Text("Why these permissions?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(PermissionManager.rationale(Manifest.permission.ACCESS_FINE_LOCATION))
                    Text(PermissionManager.rationale(Manifest.permission.READ_PHONE_STATE))
                    Text("You can deny both and still run the quality test, the survey and the Wi-Fi link check.")
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    showRationale = false
                    launcher.launch(PermissionManager.CELLULAR_PERMISSIONS)
                }) { Text("Continue") }
            },
            dismissButton = { TextButton(onClick = { showRationale = false }) { Text("Not now") } },
        )
    }
}

@Composable
private fun SectionCard(title: String, subtitle: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall)
            content()
        }
    }
}

@Composable
private fun CellularReadout(snapshot: CellularCollector.Snapshot) {
    Text(
        "Carrier: ${snapshot.carrier ?: "unknown"} · SIMs: ${snapshot.sims.size}",
        style = MaterialTheme.typography.bodySmall,
    )
    snapshot.sims.forEach { sim ->
        Text(
            "Slot ${sim.slot}: ${sim.carrier ?: "unknown"} · ${sim.rat ?: "unknown"} · roaming ${sim.roaming ?: "?"}",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    snapshot.measurements.forEach { measurement -> MeasurementRow(measurement) }
    snapshot.notes.forEach { Text("· $it", style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun WifiReadout(snapshot: WifiCollector.Snapshot) {
    Text(
        "Connected: ${snapshot.connected} · SSID: ${snapshot.ssid ?: "hidden"} · band: ${snapshot.band ?: "unknown"}",
        style = MaterialTheme.typography.bodySmall,
    )
    snapshot.measurements.forEach { MeasurementRow(it) }
    snapshot.notes.forEach { Text("· $it", style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun QualityReadout(result: InternetQualityEngine.Result) {
    Text(
        "Median ${result.latency.medianMs?.let { "%.0f".format(it) } ?: "—"} ms · min " +
            "${result.latency.minMs?.let { "%.0f".format(it) } ?: "—"} ms · jitter " +
            "${result.latency.jitterMs?.let { "%.0f".format(it) } ?: "—"} ms",
        style = MaterialTheme.typography.bodySmall,
    )
    Text(
        "Failures ${"%.1f".format(result.latency.failureRatePct)} % · download " +
            "${result.download?.mbps?.let { "%.1f".format(it) } ?: "—"} Mbps · upload " +
            "${result.upload?.mbps?.let { "%.1f".format(it) } ?: "—"} Mbps",
        style = MaterialTheme.typography.bodySmall,
    )
    Text(
        "Link index: ${result.scores["total"]?.toInt() ?: "withheld"} · stability ${result.stability.label}",
        style = MaterialTheme.typography.bodySmall,
    )
    result.limitations.forEach { Text("· $it", style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun MeasurementRow(measurement: Measurement) {
    Text(
        "${measurement.label}: ${measurement.value?.let { "%.1f".format(it) } ?: "unavailable"} ${measurement.unit.json}" +
            "  ·  ${measurement.source}",
        style = MaterialTheme.typography.bodySmall,
    )
}

/**
 * Combines whatever was actually collected. Nothing is invented: sections that
 * were not run are either absent or present with a null value and a reason.
 */
private fun assembleReport(
    cellular: CellularCollector.Snapshot?,
    wifi: WifiCollector.Snapshot?,
    quality: InternetQualityEngine.Result?,
    startedAt: Instant,
): DiagnosticReport {
    val at = Instant.now()
    val measurements = mutableListOf<Measurement>()
    cellular?.measurements?.let { measurements += it }
    wifi?.measurements?.let { measurements += it }

    quality?.let { result ->
        measurements += Measurement(
            id = "net.latency.median",
            label = "Median round-trip latency",
            value = result.latency.medianMs,
            unit = Unit.MS,
            evidence = if (result.latency.medianMs == null) Evidence.UNAVAILABLE else Evidence.MEASURED,
            source = "${result.latency.attempted} HTTPS probes",
            availability = if (result.latency.medianMs == null) Availability.TRANSIENT else Availability.AVAILABLE,
            timestamp = at,
            uncertainty = result.latency.spreadMs?.let { Uncertainty(Uncertainty.Kind.SAMPLE_SPREAD, it, "ms") },
            sampleCount = result.latency.succeeded.takeIf { it > 0 },
        )
        measurements += Measurement(
            id = "net.latency.jitter",
            label = "Jitter",
            value = result.latency.jitterMs,
            unit = Unit.MS,
            evidence = if (result.latency.jitterMs == null) Evidence.UNAVAILABLE else Evidence.MEASURED,
            source = "Mean absolute difference between consecutive probes",
            availability = if (result.latency.jitterMs == null) Availability.TRANSIENT else Availability.AVAILABLE,
            timestamp = at,
        )
        measurements += Measurement(
            id = "net.probe.failure_rate",
            label = "Probe failure rate",
            value = result.latency.failureRatePct,
            unit = Unit.PERCENT,
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
                unit = Unit.MS,
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
                unit = Unit.MBPS,
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
                unit = Unit.MBPS,
                evidence = Evidence.MEASURED,
                source = "HTTP transfer to the configured test server",
                availability = Availability.AVAILABLE,
                timestamp = at,
                context = mapOf("bytes" to transfer.bytes.toString(), "durationMs" to transfer.ms.toString()),
            )
        }
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
        session = SessionInfo(startedAt = startedAt, durationMs = java.time.Duration.between(startedAt, at).toMillis(), trigger = "manual"),
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
