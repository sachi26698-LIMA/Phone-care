package app.phonecare.diagnostics

import app.phonecare.diagnostics.core.Availability
import app.phonecare.diagnostics.core.Evidence
import app.phonecare.diagnostics.core.Measurement
import app.phonecare.diagnostics.core.MeasureUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant

/**
 * These tests cannot run in the web repository's environment (no JDK/Android
 * SDK there). They are committed so the invariants are executable in Android
 * Studio or CI with an SDK:
 *
 *   cd native/android && ./gradlew testDebugUnitTest
 */
class SchemaInvariantTest {

    private val at: Instant = Instant.parse("2026-11-09T10:00:00Z")

    @Test
    fun `measured value must be available`() {
        assertThrows(IllegalArgumentException::class.java) {
            Measurement(
                id = "lte.rsrp",
                label = "LTE RSRP",
                value = -97.0,
                unit = MeasureUnit.DBM,
                evidence = Evidence.MEASURED,
                source = "CellSignalStrengthLte.getRsrp()",
                availability = Availability.PERMISSION_DENIED,
                timestamp = at,
            )
        }
    }

    @Test
    fun `null value must be unavailable`() {
        assertThrows(IllegalArgumentException::class.java) {
            Measurement(
                id = "lte.rsrp",
                label = "LTE RSRP",
                value = null,
                unit = MeasureUnit.DBM,
                evidence = Evidence.MEASURED,
                source = "CellSignalStrengthLte.getRsrp()",
                availability = Availability.TRANSIENT,
                timestamp = at,
            )
        }
    }

    @Test
    fun `unavailable helper produces a valid row`() {
        val row = Measurement.unavailable(
            id = "nr.ss_rsrp",
            label = "5G NR SS-RSRP",
            unit = MeasureUnit.DBM,
            source = "CellSignalStrengthNr",
            availability = Availability.UNSUPPORTED,
            at = at,
        )
        assertEquals(null, row.value)
        assertEquals(Evidence.UNAVAILABLE, row.evidence)
    }

    @Test
    fun `unit names match the shared json schema`() {
        assertEquals("dBm", MeasureUnit.DBM.json)
        assertEquals("dBm/MHz", MeasureUnit.DBM_PER_MHZ.json)
        assertEquals("permission_denied", Availability.PERMISSION_DENIED.json)
    }
}
