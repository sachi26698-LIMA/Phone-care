package app.phonecare.diagnostics.cellular

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellIdentityLte
import android.telephony.CellIdentityNr
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoWcdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthWcdma
import android.telephony.ServiceState
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.SimInfo
import app.phonecare.diagnostics.core.MeasureUnit
import app.phonecare.diagnostics.core.Uncertainty
import java.time.Instant

/**
 * Reads the serving cell and subscription state.
 *
 * Everything here is modem-reported. Android's own documentation warns that
 * getAllCellInfo() may be stale because it is throttled for power, and every
 * signal constant has an "unavailable" sentinel. Those sentinels are converted
 * into null measurements with a reason — never into plausible-looking numbers.
 */
class CellularCollector(private val context: Context) {

    data class Snapshot(
        val measurements: List<Measurement>,
        val sims: List<SimInfo>,
        val carrier: String?,
        /** Human-readable radio access technology from the OS, e.g. "LTE" or "NR". */
        val rat: String?,
        /** Serving-cell RSRP when the modem exposed one; null is not zero. */
        val rsrpDbm: Double?,
        val notes: List<String>,
    )

    private val telephony: TelephonyManager? =
        context.getSystemService(TelephonyManager::class.java)

    private fun granted(permission: String): Boolean =
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    fun collect(): Snapshot {
        val at = Instant.now()
        val notes = mutableListOf<String>()
        val measurements = mutableListOf<Measurement>()
        val manager = telephony

        if (manager == null || !context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) {
            measurements += Measurement.unavailable(
                id = "lte.rsrp",
                label = "LTE RSRP",
                unit = MeasureUnit.DBM,
                source = "TelephonyManager",
                availability = Availability.UNSUPPORTED,
                at = at,
                notes = listOf("This device has no telephony radio."),
            )
            return Snapshot(
                measurements = measurements,
                sims = emptyList(),
                carrier = null,
                rat = null,
                rsrpDbm = null,
                notes = listOf("No telephony radio on this device."),
            )
        }

        val hasLocation = granted(Manifest.permission.ACCESS_FINE_LOCATION)
        val hasPhoneState = granted(Manifest.permission.READ_PHONE_STATE)

        // --- Subscription / dual SIM -------------------------------------
        val sims = if (hasPhoneState) readSubscriptions() else emptyList()
        if (!hasPhoneState) {
            notes += "SIM and carrier details need READ_PHONE_STATE."
        }

        // --- Service state -----------------------------------------------
        if (hasPhoneState && hasLocation) {
            val state = runCatching { manager.serviceState }.getOrNull()
            if (state != null) {
                measurements += serviceStateMeasurement(state, at)
            } else {
                notes += "The platform returned no service state."
            }
        } else {
            measurements += Measurement.unavailable(
                id = "net.service_state",
                label = "Service state",
                unit = MeasureUnit.COUNT,
                source = "TelephonyManager.getServiceState",
                availability = if (hasPhoneState) Availability.PERMISSION_DENIED else Availability.PERMISSION_DENIED,
                at = at,
                notes = listOf("Requires READ_PHONE_STATE and location access."),
            )
        }

        // --- Data network type -------------------------------------------
        val networkType = if (hasPhoneState) runCatching { manager.dataNetworkType }.getOrNull() else null
        if (networkType != null) {
            measurements += Measurement(
                id = "net.data_network_type",
                label = "Data network type",
                value = networkType.toDouble(),
                unit = MeasureUnit.COUNT,
                evidence = Evidence.MEASURED,
                source = "TelephonyManager.getDataNetworkType()",
                availability = Availability.AVAILABLE,
                timestamp = at,
                context = mapOf("rat" to ratName(networkType)),
                notes = listOf("Numeric value is TelephonyManager.NETWORK_TYPE_*; the rat context carries the name."),
            )
        }

        // --- Serving cell signal -----------------------------------------
        val cells = if (hasLocation) {
            runCatching { manager.allCellInfo }.getOrNull()
        } else {
            null
        }

        if (!hasLocation) {
            measurements += Measurement.unavailable(
                id = "lte.rsrp",
                label = "LTE RSRP",
                unit = MeasureUnit.DBM,
                source = "TelephonyManager.getAllCellInfo",
                availability = Availability.PERMISSION_DENIED,
                at = at,
                notes = listOf("Android gates cell identity and signal on ACCESS_FINE_LOCATION."),
            )
        } else if (cells.isNullOrEmpty()) {
            measurements += Measurement.unavailable(
                id = "lte.rsrp",
                label = "LTE RSRP",
                unit = MeasureUnit.DBM,
                source = "TelephonyManager.getAllCellInfo",
                availability = Availability.TRANSIENT,
                at = at,
                notes = listOf("The modem returned no cells; this is common right after boot or with the screen off."),
            )
        } else {
            val registered = cells.firstOrNull { it.isRegistered } ?: cells.firstOrNull()
            if (registered == null) {
                measurements += Measurement.unavailable(
                    id = "lte.rsrp",
                    label = "LTE RSRP",
                    unit = MeasureUnit.DBM,
                    source = "TelephonyManager.getAllCellInfo",
                    availability = Availability.TRANSIENT,
                    at = at,
                )
            } else {
                measurements += signalMeasurements(registered, at)
                if (!registered.isRegistered) {
                    notes += "No registered cell was reported; the values shown are the strongest reported cell."
                }
            }
        }

        notes += "Radio values are reported by the modem, are quantised (often 1 dB steps) and may be stale because Android throttles cell queries."
        val rsrp = measurements.firstOrNull { it.id == "lte.rsrp" }?.value
        return Snapshot(
            measurements = measurements,
            sims = sims,
            carrier = carrierName(manager, hasPhoneState, sims),
            rat = networkType?.let { ratName(it) },
            rsrpDbm = rsrp,
            notes = notes,
        )
    }

    private fun signalMeasurements(cell: CellInfo, at: Instant): List<Measurement> = when (cell) {
        is CellInfoLte -> lteMeasurements(cell, at)
        is CellInfoGsm -> gsmMeasurements(cell, at)
        is CellInfoWcdma -> wcdmaMeasurements(cell, at)
        else -> nrMeasurementsIfSupported(cell, at)
    }

    private fun lteMeasurements(cell: CellInfoLte, at: Instant): List<Measurement> {
        val strength: CellSignalStrengthLte = cell.cellSignalStrength
        val result = mutableListOf<Measurement>()
        result += dbm("lte.rsrp", "LTE RSRP", strength.rsrp, at, "CellSignalStrengthLte.getRsrp()")
        result += db("lte.rsrq", "LTE RSRQ", strength.rsrq, at, "CellSignalStrengthLte.getRsrq()")
        result += db("lte.rssnr", "LTE RSSNR", strength.rssnr, at, "CellSignalStrengthLte.getRssnr() (SINR estimate)")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            result += dbm("lte.rssi", "LTE RSSI", strength.rssi, at, "CellSignalStrengthLte.getRssi() (API 29+)")
        }
        val identity: CellIdentityLte = cell.cellIdentity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                identity.bands.firstOrNull()?.let { band ->
                    result += Measurement(
                        id = "lte.band",
                        label = "LTE band",
                        value = band.toDouble(),
                        unit = MeasureUnit.COUNT,
                        evidence = Evidence.MEASURED,
                        source = "CellIdentityLte.getBands()",
                        availability = Availability.AVAILABLE,
                        timestamp = at,
                        context = mapOf("pci" to identity.pci.toString()),
                    )
                }
            }
            // Timing advance lives on CellSignalStrengthLte (public since API 17), not the identity.
            val timingAdvance = strength.timingAdvance
            if (timingAdvance != CellInfo.UNAVAILABLE) {
                result += Measurement(
                    id = "lte.timing_advance",
                    label = "LTE timing advance",
                    value = timingAdvance.toDouble(),
                    unit = MeasureUnit.COUNT,
                    evidence = Evidence.MEASURED,
                    source = "CellSignalStrengthLte.getTimingAdvance()",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                    notes = listOf(
                        "Lower values generally mean the phone is closer to the tower.",
                        "Many OEM modems return UNAVAILABLE here; that is reported as null, not as zero.",
                    ),
                )
        }
        return result
    }

    private fun gsmMeasurements(cell: CellInfoGsm, at: Instant): List<Measurement> {
        val strength: CellSignalStrengthGsm = cell.cellSignalStrength
        return listOf(dbm("gsm.rssi", "GSM RSSI", strength.dbm, at, "CellSignalStrengthGsm.getDbm()"))
    }

    private fun wcdmaMeasurements(cell: CellInfoWcdma, at: Instant): List<Measurement> {
        val strength: CellSignalStrengthWcdma = cell.cellSignalStrength
        val dbmValue = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) strength.dbm else CellInfo.UNAVAILABLE
        return listOf(dbm("wcdma.rscp", "WCDMA RSCP", dbmValue, at, "CellSignalStrengthWcdma.getDbm() (API 30+)"))
    }

    /**
     * NR is isolated in its own method so the API-29 classes are never loaded on
     * older devices, which would otherwise crash at class verification.
     */
    private fun nrMeasurementsIfSupported(cell: CellInfo, at: Instant): List<Measurement> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return listOf(
                Measurement.unavailable(
                    id = "nr.ss_rsrp",
                    label = "5G NR SS-RSRP",
                    unit = MeasureUnit.DBM,
                    source = "CellSignalStrengthNr",
                    availability = Availability.UNSUPPORTED,
                    at = at,
                    notes = listOf("5G metrics require Android 10 (API 29) or newer."),
                ),
            )
        }
        val nr = cell as? android.telephony.CellInfoNr ?: return emptyList()
        val strength = nr.cellSignalStrength as android.telephony.CellSignalStrengthNr
        val identity = nr.cellIdentity as? CellIdentityNr
        return listOfNotNull(
            dbm("nr.ss_rsrp", "5G NR SS-RSRP", strength.ssRsrp, at, "CellSignalStrengthNr.getSsRsrp()"),
            db("nr.ss_rsrq", "5G NR SS-RSRQ", strength.ssRsrq, at, "CellSignalStrengthNr.getSsRsrq()"),
            db("nr.ss_sinr", "5G NR SS-SINR", strength.ssSinr, at, "CellSignalStrengthNr.getSsSinr()"),
            identity?.let {
                Measurement(
                    id = "nr.pci",
                    label = "5G NR physical cell id",
                    value = it.pci.toDouble(),
                    unit = MeasureUnit.COUNT,
                    evidence = Evidence.MEASURED,
                    source = "CellIdentityNr.getPci()",
                    availability = Availability.AVAILABLE,
                    timestamp = at,
                )
            },
        )
    }

    private fun dbm(id: String, label: String, raw: Int, at: Instant, source: String): Measurement =
        when {
            raw == CellInfo.UNAVAILABLE || raw > 0 ->
                Measurement.unavailable(
                    id, label, MeasureUnit.DBM, source, Availability.TRANSIENT, at,
                    notes = listOf("The modem returned UNAVAILABLE for this value."),
                )
            else -> Measurement(
                id = id,
                label = label,
                value = raw.toDouble(),
                unit = MeasureUnit.DBM,
                evidence = Evidence.MEASURED,
                source = source,
                availability = Availability.AVAILABLE,
                timestamp = at,
                uncertainty = Uncertainty(Uncertainty.Kind.RESOLUTION, 1.0, "dBm"),
                sampleCount = 1,
            )
        }

    private fun db(id: String, label: String, raw: Int, at: Instant, source: String): Measurement =
        when {
            raw == CellInfo.UNAVAILABLE ->
                Measurement.unavailable(
                    id, label, MeasureUnit.DB, source, Availability.TRANSIENT, at,
                    notes = listOf("The modem returned UNAVAILABLE for this value."),
                )
            else -> Measurement(
                id = id,
                label = label,
                value = raw.toDouble(),
                unit = MeasureUnit.DB,
                evidence = Evidence.MEASURED,
                source = source,
                availability = Availability.AVAILABLE,
                timestamp = at,
                uncertainty = Uncertainty(Uncertainty.Kind.RESOLUTION, 1.0, "dB"),
                sampleCount = 1,
            )
        }

    private fun serviceStateMeasurement(state: ServiceState, at: Instant): Measurement {
        val inService = state.state == ServiceState.STATE_IN_SERVICE
        return Measurement(
            id = "net.in_service",
            label = "In service",
            value = if (inService) 1.0 else 0.0,
            unit = MeasureUnit.COUNT,
            evidence = Evidence.MEASURED,
            source = "TelephonyManager.getServiceState()",
            availability = Availability.AVAILABLE,
            timestamp = at,
            context = mapOf(
                "state" to when (state.state) {
                    ServiceState.STATE_IN_SERVICE -> "in_service"
                    ServiceState.STATE_OUT_OF_SERVICE -> "out_of_service"
                    ServiceState.STATE_EMERGENCY_ONLY -> "emergency_only"
                    else -> "power_off"
                },
                "roaming" to state.roaming.toString(),
            ),
            notes = listOf("1 = in service, 0 = not in service."),
        )
    }

    private fun readSubscriptions(): List<SimInfo> {
        val subscriptions = runCatching {
            val manager = context.getSystemService(SubscriptionManager::class.java)
            manager?.activeSubscriptionInfoList ?: emptyList()
        }.getOrElse { emptyList() }

        return subscriptions.take(4).map { info ->
            val slot = info.simSlotIndex
            val perSimTelephony = runCatching {
                (context.getSystemService(TelephonyManager::class.java))
                    ?.createForSubscriptionId(info.subscriptionId)
            }.getOrNull()
            SimInfo(
                slot = slot,
                carrier = info.carrierName?.toString(),
                rat = perSimTelephony?.let { ratName(it.dataNetworkType) },
                roaming = perSimTelephony?.serviceState?.roaming,
                active = perSimTelephony?.simState == TelephonyManager.SIM_STATE_READY,
            )
        }
    }

    private fun carrierName(
        manager: TelephonyManager,
        hasPhoneState: Boolean,
        sims: List<SimInfo>,
    ): String? {
        if (hasPhoneState && sims.isNotEmpty()) {
            val current = sims.firstOrNull { it.active == true } ?: sims.first()
            return current.carrier
        }
        return runCatching { manager.networkOperatorName.takeIf { it.isNotBlank() } }.getOrNull()
    }

    private fun ratName(networkType: Int): String = when (networkType) {
        TelephonyManager.NETWORK_TYPE_NR -> "NR"
        TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
        TelephonyManager.NETWORK_TYPE_HSPAP,
        TelephonyManager.NETWORK_TYPE_HSDPA,
        TelephonyManager.NETWORK_TYPE_HSUPA,
        TelephonyManager.NETWORK_TYPE_UMTS,
        TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "WCDMA/HSPA"
        TelephonyManager.NETWORK_TYPE_EDGE,
        TelephonyManager.NETWORK_TYPE_GPRS,
        TelephonyManager.NETWORK_TYPE_GSM -> "GSM"
        TelephonyManager.NETWORK_TYPE_CDMA,
        TelephonyManager.NETWORK_TYPE_EVDO_0,
        TelephonyManager.NETWORK_TYPE_EVDO_A,
        TelephonyManager.NETWORK_TYPE_1xRTT -> "CDMA"
        TelephonyManager.NETWORK_TYPE_IWLAN -> "IWLAN (Wi-Fi Calling)"
        TelephonyManager.NETWORK_TYPE_UNKNOWN -> "unknown"
        else -> "other ($networkType)"
    }
}
