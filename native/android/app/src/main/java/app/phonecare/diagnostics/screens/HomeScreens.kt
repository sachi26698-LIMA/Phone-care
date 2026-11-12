package app.phonecare.diagnostics.screens

import android.view.View
import android.widget.LinearLayout
import app.phonecare.diagnostics.content.Guides
import app.phonecare.diagnostics.core.HistoryStore
import app.phonecare.diagnostics.data.DeviceData
import app.phonecare.diagnostics.optimization.tips
import app.phonecare.diagnostics.quality.InternetQualityEngine
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Screen
import app.phonecare.diagnostics.ui.Tab
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui
import java.time.Duration
import java.time.Instant

// ----------------------------------------------------------------- dashboard

fun dashboardScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val battery = DeviceData.battery(context)
    val storage = DeviceData.storage(context)
    val thermal = DeviceData.thermal(context)

    return Pages.page(
        host,
        "Check your real health.",
        "The same nine modules as the website, plus modem, Wi-Fi and thermal readings only a phone can take.",
    ) {
        addView(
            Ui.card(context) {
                addView(Ui.text(context, "Full check", Type.SECTION, Tokens.TEXT, bold = true))
                addView(
                    Ui.body(
                        context,
                        "Cellular, Wi-Fi, latency, throughput and stability in one run. Takes about 30 seconds " +
                            "and saves a signed-off report you can export.",
                    ).apply { setPadding(0, Tokens.dp(context, 4), 0, Tokens.dp(context, Tokens.SPACE_S)) },
                )
                addView(
                    Ui.primaryButton(context, if (host.isRunning()) "Running…" else "Run full check") {
                        runFullCheck(host)
                    }.apply { isEnabled = !host.isRunning() },
                )
                addView(
                    Ui.secondaryButton(context, "Open network lab") { host.navigate(Screen.NETWORK_HUB) },
                )
                state.lastRunAt?.let {
                    addView(
                        Ui.text(
                            context,
                            "Last full check: ${relative(it)} · ${state.runsCompleted} run(s) this session",
                            Type.LABEL,
                            Tokens.TEXT_FAINT,
                        ),
                    )
                }
            },
        )

        addView(Ui.sectionLabel(context, "At a glance"))
        addView(
            Ui.card(context) {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Battery", battery.levelPct?.let { "$it%" } ?: "—", battery.status),
                        Triple("Storage free", freeSpace(storage), storage.entries.firstOrNull()?.label),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple("Transport", state.transport.uppercase(), state.wifi?.ssid ?: state.cellular?.carrier),
                        Triple(
                            "Signal",
                            state.rsrpDbm?.let { "%.0f dBm".format(it) }
                                ?: wifiRssi(state)?.let { "%.0f dBm".format(it) }
                                ?: "not read",
                            state.cellular?.rat ?: state.wifi?.band,
                        ),
                    ),
                )
                if (thermal.statusLabel != null) {
                    addView(Ui.spacer(context, Tokens.SPACE_M))
                    addView(
                        Pages.statPair(
                            context,
                            Triple("Thermal", thermal.statusLabel, "OS classification"),
                            Triple(
                                "Battery temp",
                                thermal.batteryTemperatureC?.let { "%.1f °C".format(it) } ?: "—",
                                "fuel-gauge reading",
                            ),
                        ),
                    )
                }
            },
        )

        addView(Ui.sectionLabel(context, "Diagnostics"))
        addView(navRow(host, "Battery & health", "Capacity, temperature, charging", Screen.BATTERY))
        addView(navRow(host, "Storage", "Free space and cache", Screen.STORAGE))
        addView(navRow(host, "Display", "Resolution, refresh rate, HDR", Screen.DISPLAY))
        addView(navRow(host, "Touch", "Pointer test and multi-touch", Screen.TOUCH))
        addView(
            Ui.secondaryButton(context, "All diagnostics") { host.navigate(Screen.DIAGNOSTICS_HUB) },
        )

        addView(Ui.sectionLabel(context, "Recent results"))
        val history = state.history.all().take(2)
        if (history.isEmpty()) {
            addView(
                Ui.card(context) {
                    addView(
                        Ui.body(context, "No saved runs yet. A full check adds one here and to Results."),
                    )
                },
            )
        } else {
            history.forEach { entry -> addView(historyCard(host, entry)) }
        }

        addView(Ui.sectionLabel(context, "Suggested next steps"))
        val tipList = tips(Pages.tipInput(state)).take(2)
        tipList.forEach { tip ->
            addView(
                Ui.card(context) {
                    addView(Ui.text(context, tip.title, Type.BODY, Tokens.TEXT, bold = true))
                    addView(Ui.body(context, tip.detail))
                    addView(
                        Ui.text(context, "Evidence: ${tip.evidence.joinToString(" · ")}", Type.LABEL, Tokens.TEXT_FAINT)
                            .apply { setPadding(0, Tokens.dp(context, 4), 0, 0) },
                    )
                },
            )
        }
        addView(Ui.text(context, Guides.all.size.toString() + " guides available in More → Guides", Type.LABEL, Tokens.TEXT_FAINT))
    }
}

private fun runFullCheck(host: Host) {
    if (host.isRunning()) {
        host.status("A measurement is already running.")
        return
    }
    if (!host.hasCellularPermissions()) {
        host.status("Cellular needs location + phone-state access; running the rest first.")
    }
    host.background("Full check") {
        val state = host.state
        state.wifi = runCatching { state.wifiCollector.collect() }.getOrNull()
        if (host.hasCellularPermissions()) {
            state.cellular = runCatching { state.cellularCollector.collect() }.getOrNull()
        }
        val gateway = state.wifi?.gateway
        state.quality = runCatching {
            InternetQualityEngine(state.serverUrl).run(gatewayHost = gateway)
        }.getOrNull()
        val report = state.buildReport()
        state.saveRun(report)
    }
}

// ------------------------------------------------------------ diagnostics hub

fun diagnosticsHubScreen(host: Host): View {
    val context = host.context
    val battery = DeviceData.battery(context)
    val storage = DeviceData.storage(context)
    val thermal = DeviceData.thermal(context)
    val display = DeviceData.display(context)

    return Pages.page(
        host,
        "Diagnostics",
        "Hardware and OS checks. Values come from the Android framework; unavailable stays unavailable.",
    ) {
        addView(
            Ui.card(context) {
                addView(Ui.body(context, "8 modules · same definitions as the website, with native-only readings."))
                addView(Ui.spacer(context, Tokens.SPACE_S))
                addView(Ui.badge(context, "Native source", Ui.alpha(Tokens.VIOLET, 0.12f), Tokens.VIOLET))
            },
        )
        addView(navRow(host, "Device identity", "Model, build, RAM, uptime", Screen.DEVICE))
        addView(navRow(host, "Battery & health", battery.levelPct?.let { "$it% · ${battery.status ?: ""}" } ?: "Not reported", Screen.BATTERY))
        addView(navRow(host, "Storage", freeSpace(storage) + " free", Screen.STORAGE))
        addView(navRow(host, "Temperature", thermal.statusLabel ?: "Not supported on this API", Screen.TEMPERATURE))
        addView(navRow(host, "Display", "${display.widthPx}×${display.heightPx} · ${"%.0f".format(display.refreshRateHz)} Hz", Screen.DISPLAY))
        addView(navRow(host, "Touch", "Interactive pointer test", Screen.TOUCH))
        addView(navRow(host, "Performance", "Compute + memory class", Screen.PERFORMANCE))
        addView(navRow(host, "Compatibility", "16 hardware features", Screen.COMPATIBILITY))
    }
}

// ---------------------------------------------------------------- network hub

fun networkHubScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val cellular = state.cellular
    val wifi = state.wifi

    return Pages.page(
        host,
        "Network",
        "Cellular, Wi-Fi, internet quality and room-by-room surveys.",
    ) {
        addView(
            Ui.card(context) {
                addView(
                    Layout.row(context) {
                        addView(Ui.text(context, "Active transport", Type.SMALL, Tokens.TEXT_MUTED).apply {
                            layoutParams = Layout.weight(1f)
                        })
                        addView(Ui.statusBadge(context, state.transport.uppercase(), Tokens.VIOLET))
                    },
                )
                addView(Ui.spacer(context, Tokens.SPACE_S))
                addView(
                    Pages.statPair(
                        context,
                        Triple(
                            "Cellular",
                            cellular?.rsrpDbm?.let { "%.0f dBm".format(it) } ?: "not read",
                            cellular?.rat ?: "requires permissions",
                        ),
                        Triple(
                            "Wi-Fi",
                            wifiRssi(state)?.let { "%.0f dBm".format(it) } ?: "not read",
                            wifi?.band ?: "connect to read",
                        ),
                    ),
                )
            },
        )

        addView(Ui.sectionLabel(context, "Measurements"))
        addView(navRow(host, "Cellular diagnostics", "RSRP, RSRQ, SINR, band, SIMs", Screen.CELLULAR))
        addView(navRow(host, "Wi-Fi diagnostics", "RSSI, link speed, band, gateway, DNS", Screen.WIFI))
        addView(navRow(host, "Internet quality", "Latency, jitter, throughput, stability", Screen.QUALITY))
        addView(navRow(host, "Indoor survey", "Room-by-room, three samples minimum", Screen.SURVEY))
        addView(navRow(host, "Troubleshoot", "Rules that fire only on real readings", Screen.TROUBLESHOOT))
    }
}

// ----------------------------------------------------------------------- more

fun moreScreen(host: Host): View {
    val context = host.context
    val state = host.state
    return Pages.page(
        host,
        "More",
        "Guides, the assistant and everything this app does with your data.",
    ) {
        addView(navRow(host, "Guides", "${Guides.all.size} articles, searchable", Screen.GUIDES))
        addView(navRow(host, "Assistant", "Answers from measurement rules", Screen.ASSISTANT))
        addView(navRow(host, "Methodology", "How each reading is produced", Screen.METHODOLOGY))
        addView(navRow(host, "Settings", "Test server, data and permissions", Screen.SETTINGS))
        addView(navRow(host, "Privacy & permissions", "What is read and what never is", Screen.PRIVACY))
        addView(Ui.sectionLabel(context, "This device"))
        addView(
            Ui.card(context) {
                addView(Ui.statRow(context, "App version", DeviceData.appVersion(context) ?: "unknown"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Saved runs", state.history.count().toString()))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Survey rooms", state.survey.rooms.size.toString()))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Test server", state.serverUrl))
            },
        )
        addView(
            Ui.text(
                context,
                "PhoneCare never uploads readings, never runs in the background and never changes your settings.",
                Type.LABEL,
                Tokens.TEXT_FAINT,
            ),
        )
    }
}

// -------------------------------------------------------------------- pieces

fun navRow(host: Host, title: String, subtitle: String, screen: Screen): View =
    Ui.navRow(host.context, title, subtitle) { host.navigate(screen) }

fun historyCard(host: Host, entry: HistoryStore.Entry): View {
    val context = host.context
    return Ui.card(context) {
        val header = Layout.row(context)
        header.addView(Ui.text(context, entry.transport.uppercase(), Type.LABEL, Tokens.TEXT_FAINT, bold = true).apply {
            layoutParams = Layout.weight(1f)
        })
        header.addView(Ui.text(context, relative(entry.generatedAt), Type.LABEL, Tokens.TEXT_FAINT))
        addView(header)
        addView(Ui.text(context, entry.headline, Type.BODY, Tokens.TEXT, bold = true))
        addView(
            Ui.text(context, "${entry.measurementCount} measurements · report phonecare.report/1", Type.LABEL, Tokens.TEXT_FAINT),
        )
    }
}

fun relative(instant: Instant): String {
    val delta = Duration.between(instant, Instant.now())
    val minutes = delta.toMinutes()
    return when {
        minutes < 1 -> "just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 1440 -> "${minutes / 60}h ago"
        else -> "${minutes / 1440}d ago"
    }
}

fun freeSpace(storage: DeviceData.Storage): String {
    val entry = storage.entries.firstOrNull() ?: return "—"
    return DeviceData.bytes(entry.freeBytes)
}

fun wifiRssi(state: app.phonecare.diagnostics.core.AppState): Double? =
    state.wifi?.measurements?.firstOrNull { it.id == "wifi.rssi" }?.value

fun LinearLayout.addIf(condition: Boolean, view: () -> View) {
    if (condition) addView(view())
}
