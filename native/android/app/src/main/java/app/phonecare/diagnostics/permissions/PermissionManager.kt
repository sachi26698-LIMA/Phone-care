package app.phonecare.diagnostics.permissions

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings

/**
 * Per-feature permission handling.
 *
 * Rules enforced here:
 *  - nothing is requested at launch; the UI calls request() from a feature card
 *  - a rationale is shown before the system dialog
 *  - "denied" and "denied permanently" are different states, because they need
 *    different UI: one can retry, the other can only deep-link to app settings
 *  - every permission has a manual fallback elsewhere in the app
 */
class PermissionManager(private val activity: Activity) {

    enum class State { GRANTED, NOT_REQUESTED, DENIED, PERMANENTLY_DENIED }

    private val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun state(permission: String): State {
        val granted = activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
        if (granted) return State.GRANTED

        val askedBefore = prefs.getBoolean(key(permission), false)
        if (!askedBefore) return State.NOT_REQUESTED

        // After a first denial Android returns false for shouldShowRequestPermissionRationale
        // only when the user selected "don't ask again" (or policy blocked it).
        val canAskAgain = activity.shouldShowRequestPermissionRationale(permission)
        return if (canAskAgain) State.DENIED else State.PERMANENTLY_DENIED
    }

    fun markRequested(permission: String) {
        prefs.edit().putBoolean(key(permission), true).apply()
    }

    /** Call after the system dialog resolves. */
    fun onResult(permission: String, granted: Boolean) {
        markRequested(permission)
        if (!granted) {
            // Keep a record so a permanent denial can be explained instead of re-prompted.
            prefs.edit().putBoolean("$KEY_PREFIX${permission}_denied", true).apply()
        }
    }

    fun request(permission: String, requestCode: Int) {
        markRequested(permission)
        activity.requestPermissions(arrayOf(permission), requestCode)
    }

    fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", activity.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }

    fun openNetworkSettings() {
        // The user makes the change; the app only navigates.
        activity.startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun openWifiCallingSettings(): Boolean {
        val intent = Intent("android.settings.WIFI_CALLING_SETTINGS")
        return runCatching {
            activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        }.getOrElse {
            // Not every OEM exposes this screen; fall back to general network settings.
            openNetworkSettings()
            false
        }
    }

    private fun key(permission: String) = "$KEY_PREFIX$permission"

    companion object {
        private const val PREFS = "phonecare.permissions"
        private const val KEY_PREFIX = "asked_"

        const val REQUEST_LOCATION = 1001
        const val REQUEST_PHONE_STATE = 1002

        val CELLULAR_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.READ_PHONE_STATE,
        )

        fun rationale(permission: String): String = when (permission) {
            Manifest.permission.ACCESS_FINE_LOCATION ->
                "Android only exposes the serving cell's signal strength and the Wi-Fi network name to apps with location access. " +
                    "PhoneCare does not request a location fix and does not store coordinates. Without it, the cellular card stays empty."
            Manifest.permission.READ_PHONE_STATE ->
                "Needed to read the carrier name, network type and SIM slots. Without it you still get link tests and Wi-Fi signal."
            Manifest.permission.NEARBY_WIFI_DEVICES ->
                "Needed only for Wi-Fi scanning on Android 13+. This version does not scan networks, so it stays unused."
            else -> "This permission is required for the feature you just opened."
        }
    }
}
