package app.phonecare.diagnostics.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.View
import android.widget.LinearLayout

/**
 * The one place colours, spacing and type sizes are defined.
 *
 * The palette matches the website's brand tokens exactly:
 * #1A1A1F ink, #2D2B55 deep indigo, #6A5ACD primary violet, #A678B9 mauve,
 * #F0D9B5 sand, #F4A62A amber. Light theme only, by product decision.
 */
object Tokens {

    // Brand
    const val INK = 0xFF1A1A1F.toInt()
    const val INDIGO = 0xFF2D2B55.toInt()
    const val VIOLET = 0xFF6A5ACD.toInt()
    const val MAUVE = 0xFFA678B9.toInt()
    const val SAND = 0xFFF0D9B5.toInt()
    const val AMBER = 0xFFF4A62A.toInt()

    // Neutrals derived for a light UI
    const val BG = 0xFFFAF8F5.toInt()
    const val SURFACE = 0xFFFFFFFF.toInt()
    const val SURFACE_ALT = 0xFFF4F1EC.toInt()
    const val BORDER = 0xFFE6E1D9.toInt()
    const val TEXT = INK
    const val TEXT_MUTED = 0xFF5B5866.toInt()
    const val TEXT_FAINT = 0xFF8A8694.toInt()

    // Semantic
    const val GOOD = 0xFF2E7D5B.toInt()
    const val WARN = 0xFFB45309.toInt()
    const val BAD = 0xFFB3261E.toInt()
    const val INFO = 0xFF2F5DA8.toInt()

    // Spacing / radii (dp)
    const val SPACE_XS = 4
    const val SPACE_S = 8
    const val SPACE_M = 12
    const val SPACE_L = 16
    const val SPACE_XL = 24

    const val RADIUS_CARD = 16f
    const val RADIUS_PILL = 999f

    fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    fun dpF(context: Context, value: Float): Float =
        value * context.resources.displayMetrics.density

    fun screenWidth(context: Context): Int = context.resources.displayMetrics.widthPixels

    /** True on tablets / landscape phones where content should be capped and centred. */
    fun isWide(context: Context): Boolean =
        context.resources.configuration.screenWidthDp >= 600

    fun rounded(fill: Int, radius: Float, stroke: Int? = null, strokeWidth: Int = 1): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(fill)
            if (stroke != null) setStroke(strokeWidth, stroke)
        }

    fun pill(fill: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = RADIUS_PILL
        setColor(fill)
    }

    fun cardBackground(context: Context): GradientDrawable =
        rounded(SURFACE, dpF(context, RADIUS_CARD), BORDER, 1)
}

/** Type scale, in sp. Mirrors the website's hierarchy rather than default Material sizes. */
object Type {
    const val DISPLAY = 28f
    const val TITLE = 22f
    const val SECTION = 16f
    const val BODY = 14f
    const val SMALL = 12.5f
    const val LABEL = 11.5f

    fun bold() = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    fun medium() = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    fun regular() = Typeface.DEFAULT
    fun mono() = Typeface.MONOSPACE

    fun sp(context: Context, value: Float): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, context.resources.displayMetrics)
}

/** Layout helpers shared by every screen. */
object Layout {
    fun column(context: Context): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }

    fun row(context: Context): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = android.view.Gravity.CENTER_VERTICAL
    }

    fun row(context: Context, content: LinearLayout.() -> Unit): LinearLayout =
        row(context).apply(content)

    fun column(context: Context, content: LinearLayout.() -> Unit): LinearLayout =
        column(context).apply(content)

    fun matchWrap(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

    fun weight(weight: Float): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, weight)

    fun margins(
        context: Context,
        left: Int = 0,
        top: Int = 0,
        right: Int = 0,
        bottom: Int = 0,
    ): LinearLayout.LayoutParams = matchWrap().also {
        it.setMargins(
            Tokens.dp(context, left),
            Tokens.dp(context, top),
            Tokens.dp(context, right),
            Tokens.dp(context, bottom),
        )
    }

    fun visible(view: View, show: Boolean) {
        view.visibility = if (show) View.VISIBLE else View.GONE
    }

    fun marginTop(context: Context, view: View, dp: Int) {
        val params = view.layoutParams ?: matchWrap()
        if (params is LinearLayout.LayoutParams) {
            params.topMargin = Tokens.dp(context, dp)
            view.layoutParams = params
        }
    }
}

/** Contrast-safe helpers so text on brand fills is readable. */
object Contrast {
    fun on(fill: Int): Int {
        val r = Color.red(fill) / 255.0
        val g = Color.green(fill) / 255.0
        val b = Color.blue(fill) / 255.0
        val luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        return if (luminance > 0.45) Tokens.INK else Color.WHITE
    }

    private fun channel(value: Double): Double =
        if (value <= 0.03928) value / 12.92 else Math.pow((value + 0.055) / 1.055, 2.4)
}
