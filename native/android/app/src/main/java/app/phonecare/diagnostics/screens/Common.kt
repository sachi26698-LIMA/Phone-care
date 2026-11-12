package app.phonecare.diagnostics.screens

import android.content.Context
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.AppState
import app.phonecare.diagnostics.optimization.TipInput
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui

/** Shared page scaffolding so every screen has the same header rhythm as the website. */
object Pages {

    fun page(
        host: Host,
        title: String,
        subtitle: String? = null,
        body: LinearLayout.() -> Unit,
    ): View {
        val context = host.context
        val column = Layout.column(context).apply {
            setPadding(
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_S),
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_XL),
            )
            addView(Ui.display(context, title))
            subtitle?.let {
                addView(Ui.body(context, it).apply {
                    setPadding(0, Tokens.dp(context, 2), 0, Tokens.dp(context, Tokens.SPACE_M))
                })
            }
        }
        column.body()
        return column
    }

    /** One measurement row: value, evidence badge, source, and the reason when it is null. */
    fun measurement(context: Context, measurement: Measurement): LinearLayout {
        val row = Layout.column(context).apply {
            setPadding(0, Tokens.dp(context, Tokens.SPACE_S), 0, Tokens.dp(context, Tokens.SPACE_S))
        }
        val top = Layout.row(context)
        top.addView(Ui.text(context, measurement.label, Type.BODY, Tokens.TEXT, bold = true).apply {
            layoutParams = Layout.weight(1f)
        })
        val value = measurement.value
        val display = when {
            value == null -> "unavailable"
            measurement.unit.json == "count" -> "%.0f".format(value)
            else -> "%.1f %s".format(value, measurement.unit.json)
        }
        top.addView(
            Ui.text(
                context,
                display,
                if (value == null) Type.SMALL else Type.SECTION,
                if (value == null) Tokens.TEXT_FAINT else Tokens.TEXT,
                bold = value != null,
                mono = true,
            ),
        )
        row.addView(top)

        val meta = Layout.row(context).apply {
            setPadding(0, Tokens.dp(context, 2), 0, 0)
        }
        meta.addView(Ui.badge(context, measurement.evidence.json, Tokens.SURFACE_ALT, Tokens.TEXT_MUTED))
        if (value == null) {
            meta.addView(
                Ui.statusBadge(context, measurement.availability.json, Tokens.WARN).apply {
                    setPadding(
                        Tokens.dp(context, 6),
                        Tokens.dp(context, 3),
                        Tokens.dp(context, 6),
                        Tokens.dp(context, 3),
                    )
                    Layout.marginTop(context, this, 0)
                },
            )
        }
        meta.addView(Ui.text(context, measurement.unit.json, Type.LABEL, Tokens.TEXT_FAINT).apply {
            setPadding(Tokens.dp(context, 8), 0, 0, 0)
        })
        row.addView(meta)
        row.addView(Ui.text(context, measurement.source, Type.LABEL, Tokens.TEXT_FAINT).apply {
            setPadding(0, Tokens.dp(context, 2), 0, 0)
        })
        if (measurement.notes.isNotEmpty()) {
            row.addView(Ui.text(context, measurement.notes.first(), Type.LABEL, Tokens.TEXT_MUTED).apply {
                setPadding(0, Tokens.dp(context, 2), 0, 0)
            })
        }
        return row
    }

    fun measurements(context: Context, list: List<Measurement>): LinearLayout {
        val column = Layout.column(context)
        list.forEachIndexed { index, measurement ->
            column.addView(measurement(context, measurement))
            if (index != list.lastIndex) column.addView(Ui.divider(context))
        }
        return column
    }

    fun keyValueBlock(context: Context, pairs: List<Pair<String, String>>): LinearLayout {
        val column = Layout.column(context)
        pairs.forEachIndexed { index, (key, value) ->
            column.addView(Ui.statRow(context, key, value))
            if (index != pairs.lastIndex) column.addView(Ui.divider(context))
        }
        return column
    }

    fun notes(context: Context, notes: List<String>): LinearLayout {
        val column = Layout.column(context)
        notes.forEach { note ->
            column.addView(Ui.text(context, "• $note", Type.LABEL, Tokens.TEXT_MUTED).apply {
                setPadding(0, Tokens.dp(context, 2), 0, Tokens.dp(context, 2))
            })
        }
        return column
    }

    fun statPair(context: Context, left: Triple<String, String, String?>, right: Triple<String, String, String?>): LinearLayout =
        Ui.twoUp(
            context,
            Ui.statBlock(context, left.first, left.second, left.third),
            Ui.statBlock(context, right.first, right.second, right.third),
        )

    fun buttonRow(context: Context, views: List<View>): LinearLayout =
        Layout.column(context).apply {
            views.forEach { addView(it) }
        }

    fun inlineButtons(context: Context, views: List<View>): LinearLayout =
        Layout.row(context).apply {
            gravity = Gravity.START
            views.forEachIndexed { index, view ->
                view.layoutParams = Layout.weight(1f).also {
                    if (index != views.lastIndex) it.rightMargin = Tokens.dp(context, Tokens.SPACE_S)
                }
                addView(view)
            }
        }

    fun tipInput(state: AppState): TipInput {
        val wifi = state.wifi
        val cellular = state.cellular
        val quality = state.quality
        val best = state.survey.rooms
            .mapNotNull { room -> state.surveySession.summarise(room).score?.let { room.name to it } }
            .maxByOrNull { it.second }
        val worst = state.survey.rooms
            .mapNotNull { room -> state.surveySession.summarise(room).score?.let { room.name to it } }
            .minByOrNull { it.second }
        return TipInput(
            transport = state.transport,
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
            surveyBestRoom = best?.first,
            surveyBestScore = best?.second,
            surveyWorstRoom = worst?.first,
            surveyWorstScore = worst?.second,
        )
    }

    fun input(
        context: Context,
        hint: String,
        value: String? = null,
        numeric: Boolean = false,
    ): EditText = EditText(context).apply {
        this.hint = hint
        value?.let { setText(it) }
        setTextColor(Tokens.TEXT)
        setHintTextColor(Tokens.TEXT_FAINT)
        setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, Type.BODY)
        inputType = if (numeric) {
            android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED
        } else {
            android.text.InputType.TYPE_CLASS_TEXT
        }
        background = Tokens.rounded(Tokens.SURFACE, Tokens.dpF(context, 12f), Tokens.BORDER)
        setPadding(
            Tokens.dp(context, Tokens.SPACE_M),
            Tokens.dp(context, Tokens.SPACE_M),
            Tokens.dp(context, Tokens.SPACE_M),
            Tokens.dp(context, Tokens.SPACE_M),
        )
        layoutParams = Layout.margins(context, top = Tokens.SPACE_S, bottom = Tokens.SPACE_S)
        minHeight = Tokens.dp(context, 48)
    }

    fun metricFor(measurements: List<Measurement>, vararg ids: String): Measurement? =
        measurements.firstOrNull { it.id in ids && it.value != null }
            ?: measurements.firstOrNull { it.id in ids }
}
