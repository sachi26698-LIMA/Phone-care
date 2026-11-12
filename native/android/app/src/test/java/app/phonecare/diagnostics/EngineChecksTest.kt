package app.phonecare.diagnostics

import app.phonecare.diagnostics.verification.runEngineChecks
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Runs the 27 engine checks that used to only exist as a desktop script.
 *
 * Because the checks now live in the same source set as the JUnit tests, CI's
 * `gradle testDebugUnitTest` covers schema invariants, probe statistics, tip rules
 * and survey classification — not just the four schema tests.
 */
class EngineChecksTest {

    @Test
    fun `all engine checks pass`() {
        val failures = runEngineChecks(verbose = false)
        assertTrue(
            "engine check failures:\n" + failures.joinToString("\n"),
            failures.isEmpty(),
        )
    }
}
