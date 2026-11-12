package app.phonecare.diagnostics.screens

import android.view.View
import android.widget.LinearLayout
import app.phonecare.diagnostics.data.DeviceData
import app.phonecare.diagnostics.optimization.tips
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.survey.SurveySession
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui

// ----------------------------------------------------------------- cellular

fun cellularScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val snapshot = state.cellular

    return Pages.page(host, "Cellular", "Modem-reported values. Unavailable stays unavailable.") {
        if (!host.hasCellularPermissions()) {
            addView(
                Ui.banner(
                    context,
                    "Android hides cell identity and signal behind location access, and carrier details behind phone state. " +
                        "Both are asked for only from this screen.",
                    Tokens.WARN,
                ),
            )
            addView(
                // One primary action per screen: asking for access is a prerequisite, reading is
                // the thing the user came to do.
                Ui.secondaryButton(context, "Grant access") { host.requestCellularPermissions() },
            )
        }
        addView(
            Ui.primaryButton(context, if (host.isRunning()) "Reading…" else "Read cellular now") {
                if (host.isRunning()) {
                    host.status("A measurement is already running.")
                } else {
                    host.background("Cellular") {
                        state.cellular = runCatching { state.cellularCollector.collect() }.getOrNull()
                    }
                }
            }.apply { isEnabled = !host.isRunning() },
        )

        if (snapshot == null) {
            addView(Ui.emptyState(context, "Not read yet", "Tap “Read cellular now”. Requires location and phone-state access."))
            return@page
        }

        addView(
            Ui.cardWithHeader(context, "Serving cell", "${snapshot.carrier ?: "unknown carrier"} · ${snapshot.rat ?: "RAT unknown"}") {
                addView(Pages.measurements(context, snapshot.measurements.filter { it.id != "wifi.rssi" }))
            },
        )
        if (snapshot.sims.isNotEmpty()) {
            addView(
                Ui.cardWithHeader(context, "SIMs", "${snapshot.sims.size} active subscription(s)") {
                    snapshot.sims.forEachIndexed { index, sim ->
                        addView(
                            Ui.statRow(
                                context,
                                "Slot ${sim.slot}",
                                "${sim.carrier ?: "unknown"} · ${sim.rat ?: "—"} · ${if (sim.roaming == true) "roaming" else "home"}",
                            ),
                        )
                        if (index != snapshot.sims.lastIndex) addView(Ui.divider(context))
                    }
                    addView(Ui.text(context, "Per-SIM signal is not attributable on Android: getAllCellInfo returns cells without a slot.", Type.LABEL, Tokens.TEXT_FAINT))
                },
            )
        }
        addView(Ui.card(context) { addView(Pages.notes(context, snapshot.notes)) })
        addView(
            Ui.body(
                context,
                "Timing advance, 5G NR metrics and band reporting depend on the modem and the Android version. See Methodology → limitations.",
            ),
        )
    }
}

// --------------------------------------------------------------------- wifi

fun wifiScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val wifi = state.wifi

    return Pages.page(host, "Wi-Fi", "Connected link only — this app never scans for networks.") {
        addView(
            Ui.primaryButton(context, if (host.isRunning()) "Reading…" else "Read Wi-Fi now") {
                if (host.isRunning()) {
                    host.status("A measurement is already running.")
                } else {
                    host.background("Wi-Fi") { state.wifi = runCatching { state.wifiCollector.collect() }.getOrNull() }
                }
            }.apply { isEnabled = !host.isRunning() },
        )

        if (wifi == null) {
            addView(Ui.emptyState(context, "Not read yet", "Tap “Read Wi-Fi now” while connected to a network."))
            return@page
        }

        addView(
            Ui.cardWithHeader(context, if (wifi.connected) "Connected" else "Not on Wi-Fi", wifi.ssid ?: "SSID hidden without location") {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Band", wifi.band ?: "unknown", "derived from frequency"),
                        Triple(
                            "Link speed",
                            wifi.measurements.firstOrNull { it.id == "wifi.link_speed" }?.value?.let { "%.0f Mbps".format(it) } ?: "unavailable",
                            "negotiated PHY rate",
                        ),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(Pages.measurements(context, wifi.measurements))
            },
        )
        addView(
            Ui.cardWithHeader(context, "Gateway & DNS", "Read from LinkProperties") {
                addView(Ui.statRow(context, "Gateway", wifi.gateway ?: "not reported"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "DNS", wifi.dnsServers.joinToString().ifEmpty { "not reported" }))
                addView(Ui.text(context, "A failed TCP probe means no service answered — it does not prove the gateway is down.", Type.LABEL, Tokens.TEXT_FAINT))
            },
        )
        addView(Ui.card(context) { addView(Pages.notes(context, wifi.notes)) })
    }
}

// ------------------------------------------------------------------ quality

fun qualityScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val result = state.quality
    val serverInput = Pages.input(context, "Test server base URL", state.serverUrl)

    return Pages.page(host, "Internet quality", "Latency, jitter, throughput, stability and DNS.") {
        addView(Ui.card(context) { addView(serverInput) })
        addView(Ui.text(context, "The server must expose /api/network/ping, /download and /upload.", Type.LABEL, Tokens.TEXT_FAINT))

        if (result == null) {
            addView(Ui.emptyState(context, "No run yet", "A test takes about 30 seconds and uses a few MB of data."))
        }
        addView(
            Ui.primaryButton(context, if (host.isRunning()) "Running…" else "Run quality test") {
                val url = serverInput.text.toString().trim().trimEnd('/')
                if (!url.startsWith("http")) {
                    host.status("Enter an http(s) test server first.")
                } else if (host.isRunning()) {
                    host.status("A measurement is already running.")
                } else {
                    host.background("Quality") {
                        state.serverUrl = url
                        val monitor = app.phonecare.diagnostics.net.ConnectivityMonitor(context)
                        monitor.start()
                        try {
                            state.quality = runCatching {
                                InternetQualityEngine(url).run(gatewayHost = state.wifi?.gateway)
                            }.getOrNull()
                        } finally {
                            state.connectivity = monitor.stop()
                        }
                        state.quality?.let { state.saveRun(state.buildReport()) }
                    }
                }
            }.apply { isEnabled = !host.isRunning() },
        )

        if (result == null) return@page

        addView(
            Ui.cardWithHeader(context, "Result", if (result.scored) "Scored" else "Score withheld") {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Median", result.latency.medianMs?.let { "%.0f ms".format(it) } ?: "—", "cold probe excluded"),
                        Triple("Jitter", result.latency.jitterMs?.let { "%.1f ms".format(it) } ?: "—", "mean consecutive delta"),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple("Download", result.download?.mbps?.let { "%.1f Mbps".format(it) } ?: "—", "from this server"),
                        Triple("Upload", result.upload?.mbps?.let { "%.1f Mbps".format(it) } ?: "—", "capped endpoint"),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple("Failures", "%.1f%%".format(result.latency.failureRatePct), "${result.latency.succeeded}/${result.latency.attempted} probes"),
                        Triple("Stability", result.stability.label, result.stability.rangeMs?.let { "%.0f ms spread".format(it) }),
                    ),
                )
            },
        )

        result.scores["total"]?.let { score ->
            addView(
                Ui.card(context) {
                    addView(Ui.text(context, "${score.toInt()}", Type.DISPLAY, Tokens.TEXT, bold = true))
                    addView(Ui.body(context, "Link quality index out of 100. Derived from latency, jitter, failures and throughput."))
                },
            )
        }

        result.gateway?.let { probe ->
            addView(
                Ui.cardWithHeader(context, "Gateway probe", probe.host) {
                    addView(
                        Ui.statusBadge(
                            context,
                            if (probe.reachable) "TCP answered" else "no TCP answer",
                            if (probe.reachable) Tokens.GOOD else Tokens.WARN,
                        ),
                    )
                    addView(Ui.body(context, probe.note))
                },
            )
        }

        state.connectivity?.let { events ->
            addView(
                Ui.cardWithHeader(context, "Transitions", "while the test ran") {
                    addView(Ui.statRow(context, "Available", events.available.toString()))
                    addView(Ui.divider(context))
                    addView(Ui.statRow(context, "Lost", events.lost.toString()))
                    addView(Ui.divider(context))
                    addView(Ui.statRow(context, "Capability changes", events.capabilityChanges.toString()))
                },
            )
        }

        if (result.validityReasons.isNotEmpty()) {
            addView(
                Ui.cardWithHeader(context, "Why no score", null) {
                    result.validityReasons.forEach { reason -> addView(Ui.text(context, "• $reason", Type.SMALL, Tokens.TEXT_MUTED)) }
                },
            )
        }
        addView(Ui.card(context) { addView(Pages.notes(context, result.limitations)) })
        addView(Ui.secondaryButton(context, "Export this report") { host.shareReport(state.buildReport()) })
    }
}

// ------------------------------------------------------------------- survey

fun surveyScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val roomInput = Pages.input(context, "Room name, e.g. Kitchen")
    val dbmInput = Pages.input(context, "Optional dBm you read elsewhere (e.g. -104)", numeric = true)

    return Pages.page(host, "Indoor survey", "Room names are typed by you. No location is requested or stored.") {
        addView(
            Ui.cardWithHeader(context, "Add a room", "Scores need three samples") {
                addView(roomInput)
                addView(
                    Ui.secondaryButton(context, "Add room") {
                        val name = roomInput.text.toString()
                        if (name.isBlank()) {
                            host.status("Type a room name first.")
                        } else {
                            state.survey = state.surveySession.addRoom(state.survey, name)
                            roomInput.setText("")
                            host.refresh()
                        }
                    },
                )
            },
        )
        addView(dbmInput)

        if (state.survey.rooms.isEmpty()) {
            addView(Ui.emptyState(context, "No rooms yet", "Add the rooms you want to compare, then measure each one."))
            return@page
        }

        state.survey.rooms.forEach { room ->
            val summary = state.surveySession.summarise(room)
            addView(
                Ui.cardWithHeader(
                    context,
                    room.name,
                    "${summary.sampleCount} sample(s) · ${summary.confidence} confidence",
                    Ui.statusBadge(
                        context,
                        summary.score?.let { "${it.toInt()}/100" } ?: "not scored",
                        if (summary.score != null) Tokens.GOOD else Tokens.TEXT_FAINT,
                    ),
                ) {
                    addView(Ui.body(context, summary.note))
                    summary.latencyMedianMs?.let {
                        addView(Ui.statRow(context, "Median latency", "%.0f ms".format(it)))
                    }
                    summary.userDbmMedian?.let {
                        addView(
                            Ui.statRow(
                                context,
                                "Your dBm input",
                                "%.0f · %s".format(it, SurveySession.classifyRsrp(it)),
                            ),
                        )
                    }
                    addView(
                        Ui.secondaryButton(context, if (host.isRunning()) "Measuring…" else "Measure this room (5 probes)") {
                            if (host.isRunning()) {
                                host.status("A measurement is already running.")
                            } else {
                                host.background("Survey sample") {
                                    val run = runCatching { InternetQualityEngine(state.serverUrl).run() }.getOrNull()
                                    if (run != null) {
                                        state.survey = state.surveySession.addSample(
                                            state.surveySession.load(),
                                            room.id,
                                            run.samples,
                                            dbmInput.text.toString().toDoubleOrNull(),
                                        )
                                    }
                                }
                            }
                        }.apply { isEnabled = !host.isRunning() },
                    )
                },
            )
        }
        addView(
            Ui.banner(
                context,
                "Indoor vs outdoor is a comparison, not a diagnosis. Three samples per room is the minimum before a score appears.",
                Tokens.INFO,
            ),
        )
    }
}

// -------------------------------------------------------------- troubleshoot

fun troubleshootScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val tipList = tips(Pages.tipInput(state))

    return Pages.page(host, "Troubleshoot", "Deterministic rules. Each step names the reading that triggered it.") {
        if (state.cellular == null && state.wifi == null && state.quality == null) {
            addView(
                Ui.banner(
                    context,
                    "No measurements yet. Run a full check or a network test so the rules have evidence to fire on.",
                    Tokens.INFO,
                ),
            )
        }
        tipList.forEach { tip ->
            addView(
                Ui.cardWithHeader(
                    context,
                    tip.title,
                    "Rule: ${tip.id}",
                    Ui.badge(
                        context,
                        tip.kind.name.lowercase(),
                        Ui.alpha(Tokens.VIOLET, 0.12f),
                        Tokens.VIOLET,
                    ),
                ) {
                    addView(Ui.body(context, tip.detail))
                    addView(
                        Ui.text(context, "Evidence: ${tip.evidence.joinToString(" · ")}", Type.LABEL, Tokens.TEXT_FAINT)
                            .apply { setPadding(0, Tokens.dp(context, 4), 0, 0) },
                    )
                    when (tip.kind) {
                        app.phonecare.diagnostics.optimization.Tip.Kind.SETTINGS -> addView(
                            Ui.secondaryButton(context, "Open network settings") { host.openNetworkSettings() },
                        )
                        else -> Unit
                    }
                },
            )
        }
        addView(
            Ui.cardWithHeader(context, "Guided actions", "The app never changes settings for you") {
                addView(Ui.secondaryButton(context, "Network settings") { host.openNetworkSettings() })
                addView(Ui.secondaryButton(context, "Wi-Fi Calling settings") { host.openWifiCallingSettings() })
                addView(Ui.secondaryButton(context, "App permissions") { host.openAppSettings() })
            },
        )
        addView(
            Ui.banner(
                context,
                "No app can raise transmit power, amplify a signal or bypass a carrier limit. Anything that claims to is selling something.",
                Tokens.WARN,
            ),
        )
    }
}

/** Kept so the hub can show a compact transport summary without duplicating logic. */
fun transportSummary(host: Host): String {
    val state = host.state
    val wifi = state.wifi
    val cell = state.cellular
    val parts = mutableListOf<String>()
    wifi?.let { parts += if (it.connected) "Wi-Fi ${it.band ?: ""}" else "Wi-Fi off" }
    cell?.let { parts += it.rat ?: "cellular" }
    return if (parts.isEmpty()) "No readings yet" else parts.joinToString(" · ")
}

/** Android has no battery-temperature API on the browser side; keep the helper local. */
fun batteryLine(host: Host): String {
    val battery = DeviceData.battery(host.context)
    return battery.levelPct?.let { "$it%" } ?: "—"
}
