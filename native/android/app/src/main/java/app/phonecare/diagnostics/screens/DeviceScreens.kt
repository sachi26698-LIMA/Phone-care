package app.phonecare.diagnostics.screens

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PointF
import android.provider.Settings
import android.view.MotionEvent
import android.view.View
import android.widget.LinearLayout
import app.phonecare.diagnostics.data.DeviceData
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui

// -------------------------------------------------------------------- device

fun deviceScreen(host: Host): View {
    val context = host.context
    val identity = DeviceData.identity(context)
    return Pages.page(host, "Device identity", "Read from the Android framework, not from a browser.") {
        addView(Ui.card(context) { addView(Pages.keyValueBlock(context, identity.rows)) })
        addView(Ui.card(context) { addView(Pages.notes(context, identity.notes)) })
        addView(
            Ui.secondaryButton(context, "Copy summary") {
                val text = identity.rows.joinToString("\n") { "${it.first}: ${it.second}" }
                val clipboard = context.getSystemService(android.content.ClipboardManager::class.java)
                clipboard?.setPrimaryClip(android.content.ClipData.newPlainText("PhoneCare device", text))
                host.status("Device summary copied.")
            },
        )
    }
}

// ------------------------------------------------------------------- battery

fun batteryScreen(host: Host): View {
    val context = host.context
    val battery = DeviceData.battery(context)
    return Pages.page(host, "Battery & health", "Fuel-gauge values the browser cannot see.") {
        addView(
            Ui.card(context) {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Charge", battery.levelPct?.let { "$it%" } ?: "unavailable", battery.status),
                        Triple("Power", battery.plugged ?: "unavailable", battery.powerSave?.let { if (it) "Battery saver ON" else "Battery saver off" }),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple(
                            "Temperature",
                            battery.temperatureC?.let { "%.1f °C".format(it) } ?: "unavailable",
                            "battery cell, not CPU",
                        ),
                        Triple("Health flag", battery.health ?: "unavailable", "coarse OEM flag"),
                    ),
                )
            },
        )
        addView(
            Ui.cardWithHeader(context, "Electrical", "Often unavailable on OEM firmware") {
                addView(Ui.statRow(context, "Voltage", battery.voltageMv?.let { "$it mV" } ?: "unavailable"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Charge counter", battery.chargeCounterUah?.let { "${it / 1000} mAh" } ?: "unavailable"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Current now", battery.currentNowUa?.let { "%.1f mA".format(it / 1000.0) } ?: "unavailable"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Technology", battery.technology ?: "unavailable"))
            },
        )
        addView(Ui.card(context) { addView(Pages.notes(context, battery.notes)) })
        addView(
            Ui.secondaryButton(context, "Open battery settings") {
                runCatching {
                    context.startActivity(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }.onFailure { host.status("This device has no battery settings screen.") }
            },
        )
    }
}

// ------------------------------------------------------------------- storage

fun storageScreen(host: Host): View {
    val context = host.context
    val storage = DeviceData.storage(context)
    return Pages.page(host, "Storage", "What this app can see without privileged access.") {
        storage.entries.forEach { entry ->
            addView(
                Ui.cardWithHeader(context, entry.label, "${DeviceData.bytes(entry.freeBytes)} free of ${DeviceData.bytes(entry.totalBytes)}") {
                    val bar = android.widget.ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                        max = 1000
                        progress = if (entry.totalBytes > 0) {
                            (((entry.totalBytes - entry.freeBytes) * 1000) / entry.totalBytes).toInt()
                        } else {
                            0
                        }
                    }
                    addView(bar)
                },
            )
        }
        if (storage.entries.isEmpty()) {
            addView(Ui.emptyState(context, "No volumes reported", "StatFs returned nothing on this device."))
        }
        addView(Ui.card(context) { addView(Pages.notes(context, storage.notes)) })
    }
}

// ------------------------------------------------------------------ thermal

fun temperatureScreen(host: Host): View {
    val context = host.context
    val thermal = DeviceData.thermal(context)
    return Pages.page(host, "Temperature", "Thermal status is a coarse OS signal, not a die sensor.") {
        addView(
            Ui.card(context) {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Thermal status", thermal.statusLabel ?: "unsupported", if (thermal.supported) "PowerManager" else "needs Android 10+"),
                        Triple(
                            "Battery temp",
                            thermal.batteryTemperatureC?.let { "%.1f °C".format(it) } ?: "unavailable",
                            "fuel gauge",
                        ),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple("Power save", thermal.powerSave?.let { if (it) "On" else "Off" } ?: "unknown", null),
                        Triple("Device idle", thermal.deviceIdle?.let { if (it) "Yes" else "No" } ?: "unknown", null),
                    ),
                )
            },
        )
        addView(Ui.card(context) { addView(Pages.notes(context, thermal.notes)) })
        addView(
            Ui.banner(
                context,
                "Heat is normal under load. Sustained heat at rest, or a swollen battery, is a safety issue — stop using the phone.",
                Tokens.WARN,
            ),
        )
    }
}

// ------------------------------------------------------------------ display

fun displayScreen(host: Host): View {
    val context = host.context
    val display = DeviceData.display(context)
    return Pages.page(host, "Display", "Panel capabilities plus visual checks you run yourself.") {
        addView(
            Ui.card(context) {
                addView(
                    Pages.statPair(
                        context,
                        Triple("Resolution", "${display.widthPx}×${display.heightPx}", "${display.densityDpi} dpi"),
                        Triple(
                            "Refresh rate",
                            if (display.refreshRateHz > 0) "%.1f Hz".format(display.refreshRateHz) else "unavailable",
                            display.supportedRefreshRates.takeIf { it.isNotEmpty() }?.joinToString(", ") { "%.0f".format(it) },
                        ),
                    ),
                )
                addView(Ui.spacer(context, Tokens.SPACE_M))
                addView(
                    Pages.statPair(
                        context,
                        Triple("Physical size", display.screenInches?.let { "%.1f in".format(it) } ?: "estimated", "pixels ÷ dpi"),
                        Triple("HDR", if (display.hdrTypes.isEmpty()) "none reported" else display.hdrTypes.joinToString(", "), null),
                    ),
                )
            },
        )
        addView(Ui.sectionLabel(context, "Visual checks"))
        addView(
            Ui.body(
                context,
                "Solid colours reveal dead pixels and uniformity problems; gaps show edge lighting. You judge the panel — the app only displays.",
            ),
        )
        val swatches = listOf(
            "White" to Color.WHITE,
            "Black" to Color.BLACK,
            "Red" to Color.rgb(220, 60, 60),
            "Green" to Color.rgb(60, 170, 90),
            "Blue" to Color.rgb(60, 90, 220),
            "Grey" to Color.rgb(128, 128, 128),
            "Brand" to Tokens.VIOLET,
        )
        swatches.chunked(4).forEach { rowItems ->
            addView(
                Layout.row(context).apply {
                    rowItems.forEach { (name, color) ->
                        addView(
                            View(context).apply {
                                setBackgroundColor(color)
                                background = Tokens.rounded(color, Tokens.dpF(context, 10f), Tokens.BORDER)
                                layoutParams = LinearLayout.LayoutParams(0, Tokens.dp(context, 64), 1f).also {
                                    it.rightMargin = Tokens.dp(context, Tokens.SPACE_S)
                                    it.bottomMargin = Tokens.dp(context, Tokens.SPACE_S)
                                }
                                isClickable = true
                                setOnClickListener { host.toast("$name swatch — inspect for dead pixels") }
                            },
                        )
                    }
                },
            )
        }
        addView(Ui.card(context) { addView(Pages.notes(context, display.notes)) })
    }
}

// -------------------------------------------------------------------- touch

fun touchScreen(host: Host): View {
    val context = host.context
    return Pages.page(host, "Touch", "Draw on the panel. Gaps or stuck points indicate a digitiser problem.") {
        addView(
            Ui.card(context) {
                addView(Ui.body(context, "Every finger is drawn separately. Maximum simultaneous pointers is reported by the OS."))
                addView(Ui.spacer(context, Tokens.SPACE_M))
                val lab = TouchLabView(context)
                addView(
                    lab,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        Tokens.dp(context, 280),
                    ),
                )
                addView(
                    Ui.secondaryButton(context, "Clear canvas") {
                        lab.clear()
                        host.status("Canvas cleared.")
                    },
                )
            },
        )
        addView(
            Ui.card(context) {
                addView(Ui.statRow(context, "Multi-touch", if (context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN_MULTITOUCH)) "supported" else "not reported"))
                addView(Ui.divider(context))
                addView(Ui.statRow(context, "Hardware", if (context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN)) "present" else "absent"))
            },
        )
    }
}

/** Minimal drawing surface: one coloured ring per active pointer. */
private class TouchLabView(context: Context) : View(context) {

    private val points = mutableMapOf<Int, PointF>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        color = Tokens.VIOLET
    }

    init {
        setBackgroundColor(Tokens.SURFACE_ALT)
        isClickable = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        paint.color = Tokens.VIOLET
        points.values.forEach { point ->
            canvas.drawCircle(point.x, point.y, 44f, paint)
            paint.style = Paint.Style.FILL
            canvas.drawCircle(point.x, point.y, 8f, paint)
            paint.style = Paint.Style.STROKE
        }
        if (points.isEmpty()) {
            paint.color = Tokens.TEXT_FAINT
            canvas.drawText("Touch and draw here", 24f, height / 2f, Paint().apply {
                color = Tokens.TEXT_FAINT
                textSize = 34f
            })
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_MOVE -> {
                for (index in 0 until event.pointerCount) {
                    points[event.getPointerId(index)] = PointF(event.getX(index), event.getY(index))
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                points.remove(event.getPointerId(event.actionIndex))
            }
        }
        invalidate()
        return true
    }

    fun clear() {
        points.clear()
        invalidate()
    }
}

// -------------------------------------------------------------- performance

fun performanceScreen(host: Host): View {
    val context = host.context
    val state = host.state
    val result = state.performance
    return Pages.page(host, "Performance", "A warm-up-sensitive compute loop, plus memory class.") {
        if (result == null) {
            addView(
                Ui.card(context) {
                    addView(Ui.emptyState(context, "Not measured yet", "Run the benchmark to get a number for this exact phone."))
                    addView(
                        Ui.primaryButton(context, "Run benchmark") {
                            host.background("Benchmark") { state.performance = DeviceData.performance(context) }
                        },
                    )
                },
            )
        } else {
            addView(
                Ui.card(context) {
                    addView(Ui.text(context, "${"%,d".format(result.opsPerSecond ?: 0)} ops/s", Type.DISPLAY, Tokens.TEXT, bold = true, mono = true))
                    addView(Ui.body(context, "${"%,d".format(result.iterations)} iterations in ${result.durationMs} ms"))
                    addView(Ui.spacer(context, Tokens.SPACE_M))
                    addView(
                        Pages.statPair(
                            context,
                            Triple("Cores", result.cores.toString(), null),
                            Triple("Memory class", result.memoryClassMb?.let { "$it MB" } ?: "—", result.largeMemoryClassMb?.let { "$it MB large" }),
                        ),
                    )
                },
            )
            addView(
                Ui.secondaryButton(context, "Run again") {
                    host.background("Benchmark") { state.performance = DeviceData.performance(context) }
                },
            )
        }
        addView(Ui.card(context) { addView(Pages.notes(context, result?.notes ?: listOf("Run the benchmark to see methodology notes."))) })
        addView(
            Ui.banner(
                context,
                "Thermal throttling changes this number. Compare the same phone before and after a change, not against other devices.",
                Tokens.INFO,
            ),
        )
    }
}

// ------------------------------------------------------------ compatibility

fun compatibilityScreen(host: Host): View {
    val context = host.context
    val features = DeviceData.compatibility(context)
    return Pages.page(host, "Compatibility", "Hardware and API features reported by this device.") {
        addView(
            Ui.card(context) {
                addView(
                    Ui.text(
                        context,
                        "${features.count { it.supported }} of ${features.size} supported",
                        Type.SECTION,
                        Tokens.TEXT,
                        bold = true,
                    ),
                )
            },
        )
        features.forEach { feature ->
            addView(
                Ui.card(context) {
                    val row = Layout.row(context)
                    row.addView(Ui.text(context, feature.name, Type.BODY, Tokens.TEXT, bold = true).apply {
                        layoutParams = Layout.weight(1f)
                    })
                    row.addView(
                        Ui.statusBadge(
                            context,
                            if (feature.supported) "supported" else "absent",
                            if (feature.supported) Tokens.GOOD else Tokens.TEXT_FAINT,
                        ),
                    )
                    addView(row)
                    addView(Ui.text(context, feature.note, Type.LABEL, Tokens.TEXT_FAINT))
                },
            )
        }
    }
}
