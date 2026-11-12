package app.phonecare.diagnostics.core

import android.content.Context
import app.phonecare.diagnostics.report.ReportExporter
import java.time.Instant

/**
 * Assembles a `phonecare.report/1` document from whatever this session actually measured.
 *
 * A report always states its limitations, and it only contains rows that came from a
 * collector or the quality engine. Nothing is filled in to look complete.
 */
object ReportBuilder {

    fun build(context: Context, state: AppState): DiagnosticReport {
        val at = Instant.now()
        val measurements = mutableListOf<Measurement>()

        state.cellular?.measurements?.let { measurements += it }
        state.wifi?.measurements?.let { measurements += it }

        state.quality?.let { result ->
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
                    uncertainty = result.latency.spreadMs?.let {
                        Uncertainty(Uncertainty.Kind.SAMPLE_SPREAD, it, "ms")
                    },
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
            result.scores["total"]?.let { total ->
                measurements += Measurement(
                    id = "net.quality.index",
                    label = "Link quality index",
                    value = total,
                    unit = MeasureUnit.COUNT,
                    evidence = Evidence.ESTIMATED,
                    source = "Weighted latency/jitter/failure/throughput score",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    notes = listOf("A derived index, not a network-layer measurement."),
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
                    notes = listOf(
                        probe.note,
                        "1 = a TCP service answered; 0 = no answer, which does not prove the gateway is down.",
                    ),
                )
            }
        }

        state.connectivity?.let { events ->
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
            add("Device information comes from the Android framework; the website cannot read it, and its measurements are not merged here.")
            add("This app cannot boost, amplify or repair a signal, and it never changes your settings.")
            state.quality?.limitations?.let { addAll(it) }
            state.cellular?.notes?.let { addAll(it) }
        }

        return DiagnosticReport(
            id = AppState.newId(),
            generatedAt = at,
            app = AppInfo(),
            device = ReportExporter.deviceInfo(),
            session = SessionInfo(
                startedAt = state.sessionStarted,
                durationMs = state.sessionDurationMs(),
                trigger = "manual",
            ),
            network = NetworkInfo(
                transport = state.transport,
                carrier = state.cellular?.carrier,
                server = state.quality?.server,
                sims = state.cellular?.sims ?: emptyList(),
            ),
            measurements = measurements,
            limitations = limitations,
        )
    }
}
