package app.phonecare.diagnostics.screens

import android.Manifest
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.LinearLayout
import app.phonecare.diagnostics.content.Guides
import app.phonecare.diagnostics.data.DeviceData
import app.phonecare.diagnostics.optimization.tips
import app.phonecare.diagnostics.permissions.PermissionManager
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Screen
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui

// ------------------------------------------------------------------ results

fun resultsScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val entries = state.history.all()

    return Pages.page(host, "Results", "Saved runs live on this device only. Export shares plain JSON.") {
        addView(
            Ui.card(context) {
                addView(Ui.text(context, "${entries.size}", Type.DISPLAY, Tokens.TEXT, bold = true))
                addView(Ui.body(context, "saved report(s) · ${state.runsCompleted} run(s) in this session"))
                addView(Ui.spacer(context, Tokens.SPACE_S))
                addView(
                    Ui.primaryButton(context, "Export current measurements") {
                        host.shareReport(state.buildReport())
                    },
                )
            },
        )

        if (entries.isEmpty()) {
            addView(
                Ui.emptyState(
                    context,
                    "Nothing saved yet",
                    "Run a full check or a quality test; the report is saved automatically.",
                ),
            )
        } else {
            entries.forEach { entry ->
                addView(
                    Ui.card(context) {
                        val header = Layout.row(context)
                        header.addView(Ui.text(context, entry.headline, Type.BODY, Tokens.TEXT, bold = true).apply {
                            layoutParams = Layout.weight(1f)
                        })
                        header.addView(Ui.statusBadge(context, entry.transport.uppercase(), Tokens.VIOLET))
                        addView(header)
                        addView(
                            Ui.text(
                                context,
                                "${relative(entry.generatedAt)} · ${entry.measurementCount} measurements · ${entry.id.take(8)}",
                                Type.LABEL,
                                Tokens.TEXT_FAINT,
                            ),
                        )
                        addView(
                            Ui.secondaryButton(context, "Share this report") {
                                host.shareJson(entry.json, "PhoneCare report ${entry.id.take(8)}")
                            },
                        )
                    },
                )
            }
            addView(
                Ui.secondaryButton(context, "Clear history") {
                    state.history.clear()
                    host.status("History cleared.")
                    host.refresh()
                },
            )
        }
        addView(
            Ui.banner(
                context,
                "Reports follow the shared phonecare.report/1 schema, so the website can validate one you paste into /results.",
                Tokens.INFO,
            ),
        )
    }
}

// ------------------------------------------------------------------- guides

fun guidesScreen(host: Host): View {
    val context = host.context
    val listHolder = Layout.column(context)
    val search = Pages.input(context, "Search guides, symptoms or categories")

    fun render(query: String) {
        listHolder.removeAllViews()
        val results = Guides.search(query)
        if (results.isEmpty()) {
            listHolder.addView(Ui.emptyState(context, "No match", "Try “battery”, “wifi” or “touchscreen”."))
            return
        }
        results.forEach { guide ->
            listHolder.addView(
                Ui.card(context) {
                    val header = Layout.row(context)
                    header.addView(Ui.text(context, guide.title, Type.BODY, Tokens.TEXT, bold = true).apply {
                        layoutParams = Layout.weight(1f)
                    })
                    header.addView(Ui.badge(context, guide.category, Ui.alpha(Tokens.VIOLET, 0.12f), Tokens.VIOLET))
                    addView(header)
                    addView(Ui.body(context, guide.summary))
                    addView(
                        Ui.text(context, "${guide.readMinutes} min read · updated ${guide.updated}", Type.LABEL, Tokens.TEXT_FAINT),
                    )
                    addView(
                        Ui.secondaryButton(context, "Read guide") {
                            host.state.selectedGuideSlug = guide.slug
                            host.navigate(Screen.GUIDE_DETAIL)
                        },
                    )
                },
            )
        }
    }

    search.addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
        override fun afterTextChanged(s: Editable?) = render(s?.toString().orEmpty())
    })

    return Pages.page(host, "Guides", "The same eight guides as the website, generated from one source.") {
        addView(search)
        addView(listHolder)
        render("")
    }
}

fun guideDetailScreen(host: Host): View {
    val context = host.context
    val guide = state(host)?.let { Guides.bySlug(it) }

    if (guide == null) {
        return Pages.page(host, "Guide", null) {
            addView(Ui.emptyState(context, "Guide not found", "Return to the guide list and pick an article."))
            addView(Ui.secondaryButton(context, "Back to guides") { host.navigate(Screen.GUIDES) })
        }
    }

    return Pages.page(host, guide.title, "${guide.category} · ${guide.readMinutes} min read · updated ${guide.updated}") {
        addView(Ui.card(context) { addView(Ui.body(context, guide.summary)) })
        addView(Ui.sectionLabel(context, "Symptoms"))
        addView(
            Ui.card(context) {
                guide.symptoms.forEach { symptom -> addView(Ui.text(context, "• $symptom", Type.SMALL, Tokens.TEXT_MUTED)) }
            },
        )
        addView(Ui.sectionLabel(context, "Steps"))
        guide.steps.forEachIndexed { index, step ->
            addView(
                Ui.card(context) {
                    addView(Ui.text(context, "${index + 1}. ${step.title}", Type.SECTION, Tokens.TEXT, bold = true))
                    addView(Ui.body(context, step.detail))
                },
            )
        }
        guide.warning?.let { addView(Ui.banner(context, it, Tokens.BAD)) }
        addView(Ui.sectionLabel(context, "Sources"))
        addView(
            Ui.card(context) {
                guide.sources.forEach { source ->
                    addView(Ui.text(context, source.label, Type.SMALL, Tokens.TEXT, bold = true))
                    addView(Ui.text(context, source.url, Type.LABEL, Tokens.TEXT_FAINT, mono = true))
                }
            },
        )
        addView(Ui.secondaryButton(context, "Back to guides") { host.navigate(Screen.GUIDES) })
    }
}

private fun state(host: Host): String? = host.state.selectedGuideSlug

// ---------------------------------------------------------------- assistant

fun assistantScreen(host: Host): View {
    val context = host.context
    val input = Pages.input(context, "Describe the problem, e.g. “wifi drops in the bedroom”")
    val answerHolder = Layout.column(context)

    fun answer(question: String) {
        answerHolder.removeAllViews()
        val q = question.trim()
        if (q.isEmpty()) {
            answerHolder.addView(Ui.emptyState(context, "Ask a question", "Answers come from measured values and the shared rule set."))
            return
        }
        val matches = Guides.search(q).take(2)
        val tipList = tips(Pages.tipInput(host.state)).take(2)

        answerHolder.addView(
            Ui.cardWithHeader(context, "What the measurements say", "Based on this session") {
                if (host.state.cellular == null && host.state.wifi == null && host.state.quality == null) {
                    addView(
                        Ui.body(
                            context,
                            "Nothing has been measured yet, so there is no honest answer beyond general guidance. " +
                                "Run a full check first — the assistant will not invent readings.",
                        ),
                    )
                } else {
                    tipList.forEach { tip ->
                        addView(Ui.text(context, tip.title, Type.BODY, Tokens.TEXT, bold = true))
                        addView(Ui.body(context, tip.detail))
                        addView(Ui.spacer(context, Tokens.SPACE_S))
                    }
                }
            },
        )

        if (matches.isNotEmpty()) {
            answerHolder.addView(Ui.sectionLabel(context, "Relevant guides"))
            matches.forEach { guide ->
                answerHolder.addView(
                    Ui.card(context) {
                        addView(Ui.text(context, guide.title, Type.BODY, Tokens.TEXT, bold = true))
                        addView(Ui.body(context, guide.summary))
                        addView(
                            Ui.secondaryButton(context, "Open guide") {
                                host.state.selectedGuideSlug = guide.slug
                                host.navigate(Screen.GUIDE_DETAIL)
                            },
                        )
                    },
                )
            }
        }

        answerHolder.addView(
            Ui.banner(
                context,
                "This assistant is deterministic: it matches your words against guides and explains the current measurements. " +
                    "It is not a language model and it never invents a reading.",
                Tokens.INFO,
            ),
        )
    }

    return Pages.page(host, "Assistant", "Rule-based help, grounded in this session's measurements.") {
        addView(input)
        addView(
            Ui.primaryButton(context, "Ask") { answer(input.text.toString()) },
        )
        answerHolder.addView(Ui.emptyState(context, "Ask a question", "Answers come from measured values and the shared rule set."))
        addView(answerHolder)
    }
}

// -------------------------------------------------------------- methodology

fun methodologyScreen(host: Host): View {
    val context = host.context
    return Pages.page(host, "Methodology", "The same definitions the website publishes.") {
        addView(
            Ui.cardWithHeader(context, "Evidence levels", "Every row carries one") {
                addView(Ui.statRow(context, "measured", "platform or probe returned it"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "estimated", "derived from measurements"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "user", "typed by you, e.g. survey dBm"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "unavailable", "null with a reason"))
            },
        )
        addView(
            Ui.cardWithHeader(context, "Availability reasons", null) {
                addView(Ui.statRow(context, "available", "value present"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "permission_denied", "grant access to read it"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "unsupported", "this device/API cannot provide it"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "transient", "platform returned nothing this time"))
            },
        )
        addView(
            Ui.cardWithHeader(context, "Quality index", "one weighting shared with the website") {
                addView(Ui.statRow(context, "Download", "45%"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Upload", "25%"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Latency", "20%"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Stability", "10%"))
                addView(
                    Ui.text(
                        context,
                        "Weights re-normalise when a component is missing; no index is published for an unscored run. " +
                            "Stability treats a sub-20 ms spread as noise.",
                        Type.LABEL,
                        Tokens.TEXT_FAINT,
                    ),
                )
            },
        )
        addView(
            Ui.cardWithHeader(context, "Browser vs native", null) {
                addView(
                    Ui.body(
                        context,
                        "The website can only read what a browser exposes. This app reads the modem, the Wi-Fi link and " +
                            "hardware sensors directly. The two are never merged into one number.",
                    ),
                )
            },
        )
        addView(
            Ui.cardWithHeader(context, "What no app can do", null) {
                addView(
                    Ui.body(
                        context,
                        "Raise radio transmit power, amplify a signal, bypass carrier limits, read CPU die temperature, " +
                            "or see other apps' storage. Anything claiming otherwise is inaccurate.",
                    ),
                )
            },
        )
    }
}

// ----------------------------------------------------------------- settings

fun settingsScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val server = Pages.input(context, "Test server base URL", state.serverUrl)

    return Pages.page(host, "Settings", "Local preferences only — no account exists.") {
        addView(
            Ui.cardWithHeader(context, "Test server", "Used for latency, throughput and surveys") {
                addView(server)
                addView(
                    Ui.primaryButton(context, "Save") {
                        val url = server.text.toString().trim().trimEnd('/')
                        if (url.startsWith("http")) {
                            state.serverUrl = url
                            host.status("Test server saved.")
                        } else {
                            host.status("Enter an http(s) URL.")
                        }
                    },
                )
            },
        )
        addView(
            Ui.cardWithHeader(context, "Data", "Everything stays on this device") {
                addView(Ui.statRow(context, "Saved runs", state.history.count().toString()))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Survey rooms", state.survey.rooms.size.toString()))
                addView(
                    Ui.secondaryButton(context, "Clear diagnostic history") {
                        state.history.clear()
                        host.status("History cleared.")
                        host.refresh()
                    },
                )
                addView(
                    Ui.secondaryButton(context, "Clear survey rooms") {
                        state.survey = app.phonecare.diagnostics.survey.SurveySession.Survey(java.time.Instant.now(), emptyList())
                        state.surveySession.save(state.survey)
                        host.status("Survey cleared.")
                        host.refresh()
                    },
                )
            },
        )
        addView(
            Ui.cardWithHeader(context, "Permissions", "Managed by Android") {
                addView(Ui.secondaryButton(context, "Open app settings") { host.openAppSettings() })
                addView(Ui.secondaryButton(context, "Open network settings") { host.openNetworkSettings() })
            },
        )
        addView(
            Ui.cardWithHeader(context, "About", null) {
                addView(Ui.statRow(context, "App", "PhoneCare Android ${DeviceData.appVersion(context) ?: ""}"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Schema", "phonecare.report/1"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Website", state.serverUrl))
            },
        )
    }
}

// ------------------------------------------------------------------ privacy

fun privacyScreen(host: Host): View {
    val context = host.context
    val permissions = listOf(
        Manifest.permission.ACCESS_FINE_LOCATION to "Cell identity & signal, Wi-Fi SSID",
        Manifest.permission.READ_PHONE_STATE to "Carrier, SIM slots, network type",
        Manifest.permission.ACCESS_NETWORK_STATE to "Gateway, DNS, transitions",
        Manifest.permission.ACCESS_WIFI_STATE to "RSSI, link speed, band",
    )

    return Pages.page(host, "Privacy & permissions", "What this app reads, and what it never reads.") {
        addView(Ui.sectionLabel(context, "Permissions"))
        permissions.forEach { (permission, purpose) ->
            val state = host.permissions.state(permission)
            addView(
                Ui.card(context) {
                    val row = Layout.row(context)
                    row.addView(Ui.text(context, permission.substringAfterLast('.'), Type.BODY, Tokens.TEXT, bold = true).apply {
                        layoutParams = Layout.weight(1f)
                    })
                    row.addView(
                        Ui.statusBadge(
                            context,
                            state.name.lowercase().replace('_', ' '),
                            when (state) {
                                PermissionManager.State.GRANTED -> Tokens.GOOD
                                PermissionManager.State.PERMANENTLY_DENIED -> Tokens.BAD
                                else -> Tokens.WARN
                            },
                        ),
                    )
                    addView(row)
                    addView(Ui.text(context, purpose, Type.SMALL, Tokens.TEXT_MUTED))
                    if (state == PermissionManager.State.PERMANENTLY_DENIED) {
                        addView(Ui.secondaryButton(context, "Open app settings") { host.openAppSettings() })
                    }
                },
            )
        }
        addView(Ui.sectionLabel(context, "Never read"))
        addView(
            Ui.card(context) {
                listOf(
                    "IMEI, IMSI, ICCID or phone number",
                    "MAC address or BSSID",
                    "GPS coordinates or a location history",
                    "Wi-Fi passwords",
                    "Other apps' storage or network usage",
                    "Contacts, photos, microphone or camera",
                ).forEach { item -> addView(Ui.text(context, "• $item", Type.SMALL, Tokens.TEXT_MUTED)) }
            },
        )
        addView(
            Ui.cardWithHeader(context, "Where data goes", "Nowhere") {
                addView(
                    Ui.body(
                        context,
                        "Measurements and reports stay in app-private storage. Sharing is an explicit action that hands JSON " +
                            "to whichever app you pick. There is no analytics SDK, no account and no background collection.",
                    ),
                )
            },
        )
        addView(
            Ui.banner(
                context,
                "The website can read far less than this app. Its measurements are labelled separately and never presented as native readings.",
                Tokens.INFO,
            ),
        )
    }
}
