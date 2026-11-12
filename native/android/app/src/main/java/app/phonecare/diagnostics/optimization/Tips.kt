package app.phonecare.diagnostics.optimization

/**
 * Guided, safe next steps derived from measured values.
 *
 * Rules are deliberately conservative: each tip names the reading that triggered
 * it, and none of them claims to raise transmit power, bypass a carrier limit or
 * change a setting automatically. The app never applies a change for the user.
 */
data class Tip(
    val id: String,
    val title: String,
    val detail: String,
    val kind: Kind,
    val evidence: List<String>,
) {
    enum class Kind { MEASURE, GUIDANCE, SETTINGS }
}

data class TipInput(
    val transport: String,
    val wifiRssiDbm: Double?,
    val wifiBand: String?,
    val cellularRsrpDbm: Double?,
    val cellularRat: String?,
    val latencyMedianMs: Double?,
    val jitterMs: Double?,
    val failureRatePct: Double?,
    val dnsMs: Double?,
    val downloadMbps: Double?,
    val gatewayReachable: Boolean?,
    val surveyBestRoom: String?,
    val surveyBestScore: Double?,
    val surveyWorstRoom: String?,
    val surveyWorstScore: Double?,
)

fun tips(input: TipInput): List<Tip> {
    val result = mutableListOf<Tip>()
    val rssi = input.wifiRssiDbm
    val rsrp = input.cellularRsrpDbm
    val latency = input.latencyMedianMs
    val jitter = input.jitterMs
    val failures = input.failureRatePct
    val download = input.downloadMbps

    fun fmt(value: Double?, unit: String): String =
        if (value == null) "not measured" else "${"%.0f".format(value)} $unit"

    // 1. Room difference first: it changes where the other tests should run.
    val best = input.surveyBestScore
    val worst = input.surveyWorstScore
    if (best != null && worst != null && best - worst >= 25) {
        result += Tip(
            id = "room-gap",
            title = "The weak spot is location-specific",
            detail = "Measure again in ${input.surveyWorstRoom ?: "the weakest room"} and next to the router. " +
                "If the gap repeats, treat it as coverage: reposition the access point or add a node with a wired backhaul. " +
                "A mesh node improves reach, not the speed of each hop.",
            kind = Tip.Kind.MEASURE,
            evidence = listOf(
                "${input.surveyBestRoom ?: "Best room"}: ${fmt(best, "points")}",
                "${input.surveyWorstRoom ?: "Weakest room"}: ${fmt(worst, "points")}",
                "Gap ${fmt(best - worst, "points")} (rule: ≥ 25)",
            ),
        )
    }

    // 2. Weak Wi-Fi.
    if (rssi != null && rssi < -75) {
        result += Tip(
            id = "wifi-weak",
            title = "Wi-Fi signal is weak here",
            detail = "Move the router centrally and off the floor, away from metal and water. " +
                "Then re-measure in the same spot — a change you have not measured is a guess.",
            kind = Tip.Kind.GUIDANCE,
            evidence = listOf("Wi-Fi RSSI ${fmt(rssi, "dBm")} (rule: < −75 dBm)"),
        )
        if (input.wifiBand?.contains("2.4") == true) {
            result += Tip(
                id = "wifi-band",
                title = "Test 5 GHz in this room before deciding",
                detail = "You are on 2.4 GHz. It reaches further but carries less. Switch band in the phone's Wi-Fi settings, " +
                    "keep the same spot, and compare latency and throughput. Keep whichever is measurably better where you use the phone.",
                kind = Tip.Kind.SETTINGS,
                evidence = listOf("Band ${input.wifiBand}", "Wi-Fi RSSI ${fmt(rssi, "dBm")}"),
            )
        }
    }

    // 3. Strong local link, slow path.
    if (rssi != null && rssi >= -60 && latency != null && latency > 150) {
        result += Tip(
            id = "upstream",
            title = "The Wi-Fi link looks healthy; the delay is upstream",
            detail = "Run the same test at a different hour, then compare. If it stays high, reboot the router and measure again — " +
                "only the re-test tells you whether the reboot changed anything.",
            kind = Tip.Kind.MEASURE,
            evidence = listOf("Wi-Fi RSSI ${fmt(rssi, "dBm")}", "Latency ${fmt(latency, "ms")}"),
        )
    }

    // 4. Weak cellular.
    if (rsrp != null && rsrp < -105) {
        result += Tip(
            id = "cellular-weak",
            title = "Cellular coverage is marginal in this spot",
            detail = "Test at a window or balcony, then compare. If calls matter more than data here, Wi-Fi Calling is the practical " +
                "workaround when your carrier supports it. Only a carrier-approved, fixed booster installed by a technician can " +
                "legitimately amplify cellular signal; an app cannot.",
            kind = Tip.Kind.MEASURE,
            evidence = listOf("RSRP ${fmt(rsrp, "dBm")} (rule: < −105 dBm)", "Network type ${input.cellularRat ?: "unknown"}"),
        )
        result += Tip(
            id = "wifi-calling",
            title = "Check Wi-Fi Calling in your network settings",
            detail = "Wi-Fi Calling is controlled by the carrier and the OS. The app can open the settings screen, but you make the change. " +
                "Fix the Wi-Fi link first, or calls will inherit its problems.",
            kind = Tip.Kind.SETTINGS,
            evidence = listOf("RSRP ${fmt(rsrp, "dBm")}"),
        )
    }

    // 5. Strong radio, low throughput.
    if (rsrp != null && rsrp >= -95 && download != null && download < 2) {
        result += Tip(
            id = "congestion",
            title = "Radio conditions are fine but throughput is very low",
            detail = "This usually means congestion, a backhaul limit or a plan-level cap rather than coverage. " +
                "Repeat the test at another time and note the hour; check your plan's usage in the carrier app.",
            kind = Tip.Kind.MEASURE,
            evidence = listOf("RSRP ${fmt(rsrp, "dBm")}", "Download ${"%.1f".format(download)} Mbps (rule: < 2 Mbps)"),
        )
    }

    // 6. Instability.
    if ((jitter != null && jitter > 60) || (failures != null && failures > 5)) {
        result += Tip(
            id = "instability",
            title = "The link is unstable, not just slow",
            detail = "On Wi-Fi, change channel or band from the router's admin page, then measure again. " +
                "2.4 GHz is shared with neighbours and Bluetooth; 5 GHz is usually cleaner at short range.",
            kind = Tip.Kind.GUIDANCE,
            evidence = listOf("Jitter ${fmt(jitter, "ms")}", "Probe failures ${fmt(failures, "%")}"),
        )
    }

    // 7. DNS.
    if (input.dnsMs != null && input.dnsMs > 100) {
        result += Tip(
            id = "dns",
            title = "Name resolution is slow",
            detail = "DNS servers are configured on the router or in the phone's network settings. Change it there, then re-measure. " +
                "The app does not change it for you.",
            kind = Tip.Kind.SETTINGS,
            evidence = listOf("DNS lookup ${fmt(input.dnsMs, "ms")} (rule: > 100 ms)"),
        )
    }

    // 8. Gateway probe caveat.
    if (input.gatewayReachable == false) {
        result += Tip(
            id = "gateway",
            title = "Gateway probe was inconclusive",
            detail = "The router did not answer on TCP 53, 80 or 443. Many routers refuse those ports while forwarding traffic " +
                "perfectly, so this is not evidence of a fault. If every test fails, check the router's indicator lights and restart it.",
            kind = Tip.Kind.GUIDANCE,
            evidence = listOf("Gateway TCP probe: no answer"),
        )
    }

    if (result.isEmpty()) {
        result += Tip(
            id = "no-fault",
            title = "No fault found in this run",
            detail = "That does not prove there is none. Repeat the test at another time and in the room where the problem happens; " +
                "an intermittent fault needs more than one sample.",
            kind = Tip.Kind.MEASURE,
            evidence = listOf(
                "Latency ${fmt(latency, "ms")}",
                "Jitter ${fmt(jitter, "ms")}",
                "Download ${download?.let { "%.1f".format(it) } ?: "not measured"} Mbps",
            ),
        )
    }

    result += Tip(
        id = "limits",
        title = "What this app will not do",
        detail = "It does not increase modem or router transmit power, does not bypass carrier limits, and does not change settings silently. " +
            "Signal strength depends on physics, the network and the hardware — measurement and placement are the honest levers.",
        kind = Tip.Kind.GUIDANCE,
        evidence = listOf("Product boundary"),
    )

    return result
}
