package app.phonecare.diagnostics

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import app.phonecare.diagnostics.core.AppState
import app.phonecare.diagnostics.core.DiagnosticReport
import app.phonecare.diagnostics.permissions.PermissionManager
import app.phonecare.diagnostics.screens.Pages
import app.phonecare.diagnostics.ui.Host
import app.phonecare.diagnostics.ui.Layout
import app.phonecare.diagnostics.ui.Screen
import app.phonecare.diagnostics.ui.Tab
import app.phonecare.diagnostics.ui.Tokens
import app.phonecare.diagnostics.ui.Type
import app.phonecare.diagnostics.ui.Ui
import java.util.ArrayDeque
import java.util.concurrent.Executors

/**
 * Single-activity shell: app bar + scrollable screen + bottom navigation.
 *
 * The shell owns navigation, the background executor and permission prompts so that
 * every screen stays a pure function of [AppState]. Tab roots reset the stack; pushed
 * screens stack up and the system back gesture pops them.
 */
class MainActivity : Activity(), Host {

    override lateinit var state: AppState
    override lateinit var permissions: PermissionManager
    override val context: Context get() = this

    private val worker = Executors.newSingleThreadExecutor()
    private val backStack = ArrayDeque<Screen>()

    @Volatile
    private var running = false

    private lateinit var root: LinearLayout
    private lateinit var titleView: TextView
    private lateinit var backChip: TextView
    private lateinit var statusView: TextView
    private lateinit var scroll: ScrollView
    private lateinit var content: LinearLayout
    private lateinit var navBar: LinearLayout
    private var current: Screen = Screen.DASHBOARD

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        state = AppState(applicationContext)
        permissions = PermissionManager(this)

        root = Layout.column(this).apply {
            setBackgroundColor(Tokens.BG)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
            )
        }
        root.addView(buildAppBar())
        scroll = ScrollView(this).apply {
            isFillViewport = true
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
        }
        content = Layout.column(this)
        scroll.addView(content)
        root.addView(scroll)
        navBar = buildNavBar()
        root.addView(navBar)
        setContentView(root)

        show(Screen.DASHBOARD, resetStack = true)
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            root.post { dumpTree() }
        }
    }

    /**
     * Debug builds log the laid-out tree. The emulator walk reads it back with `logcat -s
     * PhoneCareDiag`, which is how a layout defect gets diagnosed from evidence instead of a
     * screenshot and a guess. Never runs in a release build.
     */
    private fun dumpTree() {
        fun emit(view: View, depth: Int) {
            if (depth > 6) return
            val params = view.layoutParams
            val name = view.javaClass.simpleName
            val orientation = (view as? LinearLayout)?.let {
                if (it.orientation == LinearLayout.HORIZONTAL) "H" else "V"
            } ?: ""
            val label = (view as? TextView)?.text?.toString()?.take(24)?.replace("\n", " ") ?: ""
            Log.i(
                "PhoneCareDiag",
                "${"  ".repeat(depth)}$name$orientation w=${view.width} h=${view.height} " +
                    "params=(${params?.width},${params?.height}) vis=${view.visibility} $label",
            )
            if (view is android.view.ViewGroup) {
                for (i in 0 until view.childCount) emit(view.getChildAt(i), depth + 1)
            }
        }
        Log.i("PhoneCareDiag", "=== tree after Dashboard layout, window=${root.width}x${root.height}")
        emit(root, 0)
    }

    // ------------------------------------------------------------------ chrome

    private fun buildAppBar(): View {
        val bar = Layout.column(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setBackgroundColor(Tokens.SURFACE)
            setPadding(
                Tokens.dp(this@MainActivity, Tokens.SPACE_L),
                Tokens.dp(this@MainActivity, Tokens.SPACE_M),
                Tokens.dp(this@MainActivity, Tokens.SPACE_L),
                Tokens.dp(this@MainActivity, Tokens.SPACE_S),
            )
        }
        val top = Layout.row(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }
        top.addView(
            Ui.text(this, "PhoneCare", Type.SECTION, Tokens.VIOLET, bold = true).apply {
                setLetterSpacing(0.02f)
            },
        )
        top.addView(Layout.flexSpacer(this))
        top.addView(Ui.badge(this, "native", Ui.alpha(Tokens.VIOLET, 0.12f), Tokens.VIOLET))
        bar.addView(top)

        val titleRow = Layout.row(this)
        backChip = Ui.text(this, "\u2039 Back", Type.LABEL, Tokens.VIOLET, bold = true).apply {
            setPadding(0, Tokens.dp(this@MainActivity, Tokens.SPACE_S), Tokens.dp(this@MainActivity, Tokens.SPACE_M), Tokens.dp(this@MainActivity, Tokens.SPACE_S))
            isClickable = true
            minimumHeight = Tokens.dp(this@MainActivity, 44)
            gravity = Gravity.CENTER_VERTICAL
            contentDescription = "Go back"
            setOnClickListener { back() }
            visibility = View.GONE
            tag = "back"
        }
        titleRow.addView(backChip)
        titleView = Ui.title(this, "Dashboard").apply {
            setPadding(0, Tokens.dp(this@MainActivity, Tokens.SPACE_XS), 0, 0)
        }
        titleRow.addView(titleView)
        bar.addView(titleRow)

        statusView = Ui.text(this, "", Type.SMALL, Tokens.TEXT_MUTED).apply {
            setPadding(0, Tokens.dp(this@MainActivity, 2), 0, 0)
            visibility = View.GONE
        }
        bar.addView(statusView)
        bar.addView(Ui.divider(this))
        return bar
    }

    private fun buildNavBar(): LinearLayout {
        val bar = Layout.row(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setBackgroundColor(Tokens.SURFACE)
            setPadding(
                Tokens.dp(this@MainActivity, Tokens.SPACE_S),
                Tokens.dp(this@MainActivity, Tokens.SPACE_XS),
                Tokens.dp(this@MainActivity, Tokens.SPACE_S),
                Tokens.dp(this@MainActivity, Tokens.SPACE_S),
            )
            elevation = Tokens.dpF(this@MainActivity, 8f)
        }
        Tab.entries.forEach { tab ->
            val item = Layout.column(this).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                layoutParams = Layout.weight(1f)
                minimumHeight = Tokens.dp(this@MainActivity, 48)
                isClickable = true
                setOnClickListener { switchTab(tab) }
                setPadding(0, Tokens.dp(this@MainActivity, Tokens.SPACE_XS), 0, 0)
            }
            item.addView(
                Ui.text(this, tab.label, Type.LABEL, Tokens.TEXT_FAINT, bold = false).apply {
                    gravity = Gravity.CENTER_HORIZONTAL
                    tag = "label"
                },
            )
            item.addView(
                View(this).apply {
                    setBackgroundColor(Tokens.VIOLET)
                    layoutParams = LinearLayout.LayoutParams(
                        Tokens.dp(this@MainActivity, 16),
                        Tokens.dp(this@MainActivity, 3),
                    ).also { it.topMargin = Tokens.dp(this@MainActivity, 4) }
                    visibility = View.INVISIBLE
                    tag = "indicator"
                },
            )
            bar.addView(item)
        }
        return bar
    }

    private fun paintNav(selected: Tab?) {
        for (index in 0 until navBar.childCount) {
            val item = navBar.getChildAt(index) as LinearLayout
            val tab = Tab.entries[index]
            val label = item.findViewWithTag<TextView>("label")
            val indicator = item.findViewWithTag<View>("indicator")
            label?.setTextColor(if (tab == selected) Tokens.VIOLET else Tokens.TEXT_FAINT)
            indicator?.visibility = if (tab == selected) View.VISIBLE else View.INVISIBLE
        }
    }

    // -------------------------------------------------------------- navigation

    private fun show(screen: Screen, resetStack: Boolean) {
        current = screen
        if (resetStack) backStack.clear()
        titleView.text = screen.title
        content.removeAllViews()
        val view = screen.render(this)
        if (Tokens.isWide(this)) {
            val frame = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(
                    Tokens.dp(this@MainActivity, Tokens.SPACE_XL),
                    0,
                    Tokens.dp(this@MainActivity, Tokens.SPACE_XL),
                    0,
                )
            }
            val capped = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    Tokens.dp(this@MainActivity, 720),
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                )
                addView(view)
            }
            frame.addView(capped)
            content.addView(frame)
        } else {
            content.addView(view)
        }
        scroll.scrollTo(0, 0)
        // The page renders its own heading; showing the identical text in the app bar as well is
        // the sort of duplicated chrome a reviewer reads as a defect. Keep the bar title only
        // when the page leads with something else (a guide's own title, for example).
        val pageHeading = firstText(view)
        titleView.visibility = if (pageHeading == screen.title) View.GONE else View.VISIBLE
        backChip.visibility = if (backStack.isEmpty() && screen.tab != null) View.GONE else View.VISIBLE
        paintNav(screen.tab)
    }

    private fun firstText(view: View): String? {
        if (view is TextView && view.text.isNotBlank()) return view.text.toString().trim()
        if (view is android.view.ViewGroup) {
            for (index in 0 until view.childCount) {
                firstText(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    override fun navigate(screen: Screen) {
        if (screen == current) return
        backStack.addLast(current)
        show(screen, resetStack = false)
    }

    override fun switchTab(tab: Tab) {
        val rootScreen = Screen.forTab(tab)
        backStack.clear()
        show(rootScreen, resetStack = true)
    }

    override fun back(): Boolean {
        if (backStack.isEmpty()) return false
        val previous = backStack.removeLast()
        show(previous, resetStack = false)
        return true
    }

    @Suppress("DEPRECATION")
    @Deprecated("Kept for API < 33 where no OnBackInvokedDispatcher exists")
    override fun onBackPressed() {
        if (!back()) super.onBackPressed()
    }

    // ------------------------------------------------------------------- host

    override fun status(message: String) {
        statusView.text = message
        statusView.visibility = if (message.isBlank()) View.GONE else View.VISIBLE
    }

    override fun background(label: String, task: () -> Unit) {
        if (running) {
            status("A measurement is already running.")
            return
        }
        running = true
        status("$label: working…")
        worker.execute {
            try {
                task()
            } catch (error: Throwable) {
                runOnUiThread { status("$label failed: ${error.javaClass.simpleName}") }
            } finally {
                runOnUiThread {
                    running = false
                    if (statusView.text.toString().endsWith("working…")) status("$label complete.")
                    refresh()
                }
            }
        }
    }

    override fun backgroundWithUi(label: String, task: (done: (() -> Unit) -> Unit) -> Unit) {
        background(label) { task { runOnUiThread { } } }
    }

    override fun ui(block: () -> Unit) {
        runOnUiThread(block)
    }

    override fun refresh() {
        show(current, resetStack = false)
    }

    override fun shareReport(report: DiagnosticReport) {
        val intent = state.exporter.shareIntent(report)
        startActivity(Intent.createChooser(intent, "Share PhoneCare report"))
        status("Report prepared — it contains only what this session measured.")
    }

    override fun shareJson(json: String, subject: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, json)
        }
        startActivity(Intent.createChooser(intent, "Share PhoneCare report"))
    }

    override fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun hasCellularPermissions(): Boolean =
        checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    override fun requestCellularPermissions() {
        PermissionManager.CELLULAR_PERMISSIONS.forEach { permission -> permissions.markRequested(permission) }
        requestPermissions(PermissionManager.CELLULAR_PERMISSIONS, PermissionManager.REQUEST_LOCATION)
    }

    override fun openAppSettings() {
        permissions.openAppSettings()
    }

    override fun openNetworkSettings() {
        permissions.openNetworkSettings()
    }

    override fun openWifiCallingSettings() {
        if (!permissions.openWifiCallingSettings()) {
            status("This device has no Wi-Fi Calling screen; opened network settings instead.")
        }
    }

    override fun isRunning(): Boolean = running

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissionNames: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissionNames, grantResults)
        if (requestCode != PermissionManager.REQUEST_LOCATION) return
        permissionNames.forEachIndexed { index, permission ->
            permissions.onResult(
                permission,
                grantResults.getOrNull(index) == android.content.pm.PackageManager.PERMISSION_GRANTED,
            )
        }
        status(
            if (hasCellularPermissions()) {
                "Access granted. Cellular readings are available."
            } else {
                "Access denied. Cellular stays empty with a reason; everything else still works."
            },
        )
        refresh()
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }
}
