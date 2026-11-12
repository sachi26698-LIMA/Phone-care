package app.phonecare.diagnostics.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * Reusable design-system pieces. Every screen is built from these, which is what
 * keeps the Android app visually identical to the website instead of drifting.
 */
object Ui {

    fun text(
        context: Context,
        value: String,
        size: Float = Type.BODY,
        color: Int = Tokens.TEXT,
        bold: Boolean = false,
        mono: Boolean = false,
        lineSpacing: Float = 1.15f,
    ): TextView = TextView(context).apply {
        text = value
        setTextColor(color)
        setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, size)
        typeface = when {
            mono -> Typeface.MONOSPACE
            bold -> Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            else -> Typeface.DEFAULT
        }
        setLineSpacing(0f, lineSpacing)
    }

    fun display(context: Context, value: String): TextView =
        text(context, value, Type.DISPLAY, Tokens.TEXT, bold = true)

    fun title(context: Context, value: String): TextView =
        text(context, value, Type.TITLE, Tokens.TEXT, bold = true)

    fun body(context: Context, value: String, color: Int = Tokens.TEXT_MUTED): TextView =
        text(context, value, Type.BODY, color)

    fun sectionLabel(context: Context, value: String): TextView =
        text(context, value.uppercase(), Type.LABEL, Tokens.TEXT_FAINT, bold = true).apply {
            letterSpacing = 0.08f
            setPadding(0, Tokens.dp(context, Tokens.SPACE_M), 0, Tokens.dp(context, Tokens.SPACE_S))
        }

    /** A surface card with the brand border and radius. */
    fun card(context: Context, content: LinearLayout.() -> Unit = {}): LinearLayout {
        val box = Layout.column(context).apply {
            background = Tokens.cardBackground(context)
            setPadding(
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_L),
            )
            layoutParams = Layout.margins(context, bottom = Tokens.SPACE_M)
            elevation = Tokens.dpF(context, 1f)
        }
        box.content()
        return box
    }

    fun cardWithHeader(
        context: Context,
        title: String,
        subtitle: String? = null,
        trailing: View? = null,
        content: LinearLayout.() -> Unit = {},
    ): LinearLayout {
        val box = card(context) {
            val header = Layout.row(context)
            val titles = Layout.column(context).apply { layoutParams = Layout.weight(1f) }
            titles.addView(text(context, title, Type.SECTION, Tokens.TEXT, bold = true))
            subtitle?.let {
                titles.addView(text(context, it, Type.SMALL, Tokens.TEXT_FAINT).apply {
                    setPadding(0, Tokens.dp(context, 2), 0, 0)
                })
            }
            header.addView(titles)
            trailing?.let { header.addView(it) }
            addView(header)
            addView(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Tokens.dp(context, Tokens.SPACE_M)) })
            content()
        }
        return box
    }

    fun statRow(context: Context, label: String, value: String, note: String? = null): LinearLayout {
        val row = Layout.row(context).apply {
            setPadding(0, Tokens.dp(context, 5), 0, Tokens.dp(context, 5))
        }
        row.addView(text(context, label, Type.SMALL, Tokens.TEXT_MUTED).apply {
            layoutParams = Layout.weight(1f)
        })
        row.addView(text(context, value, Type.SMALL, Tokens.TEXT, bold = true, mono = true).apply {
            gravity = Gravity.END
        })
        note?.let {
            val column = Layout.column(context)
            column.addView(row)
            column.addView(text(context, it, Type.LABEL, Tokens.TEXT_FAINT))
            return column
        }
        return row
    }

    /** Key-value grid used by Dashboard and device screens. */
    fun statBlock(context: Context, label: String, value: String, caption: String? = null): LinearLayout =
        Layout.column(context).apply {
            addView(text(context, label.uppercase(), Type.LABEL, Tokens.TEXT_FAINT, bold = true).apply {
                letterSpacing = 0.06f
            })
            addView(text(context, value, Type.SECTION, Tokens.TEXT, bold = true).apply {
                setPadding(0, Tokens.dp(context, 2), 0, 0)
            })
            caption?.let {
                addView(text(context, it, Type.LABEL, Tokens.TEXT_FAINT))
            }
        }

    fun badge(context: Context, label: String, fill: Int = Tokens.SURFACE_ALT, textColor: Int = Tokens.TEXT_MUTED): TextView =
        text(context, label, Type.LABEL, textColor, bold = true).apply {
            background = Tokens.pill(fill)
            setPadding(
                Tokens.dp(context, 8),
                Tokens.dp(context, 3),
                Tokens.dp(context, 8),
                Tokens.dp(context, 3),
            )
        }

    fun toneFor(level: String): Int = when (level) {
        "good", "Excellent", "Stable", "stable" -> Tokens.GOOD
        "warn", "Weak", "Fair", "unstable" -> Tokens.WARN
        "bad", "Very weak", "Poor" -> Tokens.BAD
        else -> Tokens.INFO
    }

    fun statusBadge(context: Context, label: String, tone: Int): TextView =
        badge(context, label, alpha(tone, 0.14f), tone)

    fun primaryButton(context: Context, label: String, onClick: () -> Unit): Button =
        button(context, label, Tokens.VIOLET, Contrast.on(Tokens.VIOLET), onClick)

    fun secondaryButton(context: Context, label: String, onClick: () -> Unit): Button =
        button(context, label, Tokens.SURFACE_ALT, Tokens.TEXT, onClick)

    fun amberButton(context: Context, label: String, onClick: () -> Unit): Button =
        button(context, label, Tokens.AMBER, Tokens.INK, onClick)

    private fun button(context: Context, label: String, fill: Int, textColor: Int, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            isAllCaps = false
            setTextColor(textColor)
            backgroundTintList = ColorStateList.valueOf(fill)
            stateListAnimator = null
            setPadding(
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_M),
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_M),
            )
            minHeight = Tokens.dp(context, 48)
            layoutParams = Layout.margins(context, top = Tokens.SPACE_S, bottom = Tokens.SPACE_S)
            setOnClickListener { onClick() }
        }

    fun chip(context: Context, label: String, active: Boolean, onClick: () -> Unit): TextView =
        text(
            context,
            label,
            Type.SMALL,
            if (active) Contrast.on(Tokens.VIOLET) else Tokens.TEXT_MUTED,
            bold = active,
        ).apply {
            background = Tokens.pill(if (active) Tokens.VIOLET else Tokens.SURFACE_ALT)
            setPadding(
                Tokens.dp(context, 12),
                Tokens.dp(context, 8),
                Tokens.dp(context, 12),
                Tokens.dp(context, 8),
            )
            layoutParams = Layout.margins(context, right = Tokens.SPACE_S)
            minHeight = Tokens.dp(context, 40)
            isClickable = true
            setOnClickListener { onClick() }
        }

    fun banner(context: Context, message: String, tone: Int = Tokens.INFO): LinearLayout =
        Layout.column(context).apply {
            background = Tokens.rounded(alpha(tone, 0.10f), Tokens.dpF(context, 12f), alpha(tone, 0.35f))
            setPadding(
                Tokens.dp(context, Tokens.SPACE_M),
                Tokens.dp(context, Tokens.SPACE_M),
                Tokens.dp(context, Tokens.SPACE_M),
                Tokens.dp(context, Tokens.SPACE_M),
            )
            layoutParams = Layout.margins(context, top = Tokens.SPACE_S, bottom = Tokens.SPACE_S)
            addView(text(context, message, Type.SMALL, Tokens.TEXT))
        }

    fun emptyState(context: Context, title: String, message: String): LinearLayout =
        Layout.column(context).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(
                0,
                Tokens.dp(context, Tokens.SPACE_XL),
                0,
                Tokens.dp(context, Tokens.SPACE_XL),
            )
            addView(text(context, title, Type.SECTION, Tokens.TEXT, bold = true))
            addView(text(context, message, Type.SMALL, Tokens.TEXT_FAINT).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(0, Tokens.dp(context, Tokens.SPACE_S), 0, 0)
            })
        }

    fun progressStrip(context: Context, message: String): LinearLayout =
        Layout.row(context).apply {
            addView(ProgressBar(context, null, android.R.attr.progressBarStyleSmall).apply {
                layoutParams = Layout.margins(context, right = Tokens.SPACE_M)
            })
            addView(text(context, message, Type.SMALL, Tokens.TEXT_MUTED))
        }

    fun divider(context: Context): View = View(context).apply {
        setBackgroundColor(Tokens.BORDER)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1).also {
            it.topMargin = Tokens.dp(context, Tokens.SPACE_S)
            it.bottomMargin = Tokens.dp(context, Tokens.SPACE_S)
        }
    }

    fun spacer(context: Context, dp: Int = Tokens.SPACE_M): View =
        View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Tokens.dp(context, dp)) }

    fun twoUp(context: Context, left: View, right: View): LinearLayout =
        Layout.row(context).apply {
            left.layoutParams = Layout.weight(1f).also { it.rightMargin = Tokens.dp(context, Tokens.SPACE_S) }
            right.layoutParams = Layout.weight(1f).also { it.leftMargin = Tokens.dp(context, Tokens.SPACE_S) }
            addView(left)
            addView(right)
        }

    fun alpha(color: Int, factor: Float): Int {
        val a = ((color ushr 24) and 0xFF) * factor
        return (a.toInt() and 0xFF shl 24) or (color and 0x00FFFFFF)
    }

    /** A tappable list row with a chevron, used by hubs and the More screen. */
    fun navRow(context: Context, title: String, subtitle: String, onClick: () -> Unit): LinearLayout =
        Layout.row(context).apply {
            background = Tokens.cardBackground(context)
            setPadding(
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_M),
                Tokens.dp(context, Tokens.SPACE_L),
                Tokens.dp(context, Tokens.SPACE_M),
            )
            layoutParams = Layout.margins(context, bottom = Tokens.SPACE_S)
            minimumHeight = Tokens.dp(context, 56)
            isClickable = true
            setOnClickListener { onClick() }
            val column = Layout.column(context).apply { layoutParams = Layout.weight(1f) }
            column.addView(text(context, title, Type.BODY, Tokens.TEXT, bold = true))
            column.addView(text(context, subtitle, Type.LABEL, Tokens.TEXT_FAINT))
            addView(column)
            addView(text(context, "›", Type.TITLE, Tokens.TEXT_FAINT))
        }
}
