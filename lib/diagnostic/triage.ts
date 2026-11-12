/**
 * Rule-based troubleshooting engine.
 *
 * Rules come from docs/native/NETWORK-SPEC.md §7 and only fire when the
 * measurements that justify them exist. Unknown inputs produce "insufficient
 * data" plus the exact list of missing readings — never a guess.
 */

export type Cause =
  | "wifi_coverage"
  | "cellular_coverage"
  | "upstream"
  | "dns"
  | "congestion"
  | "instability"
  | "room_specific"
  | "no_fault_found"
  | "insufficient_data";

export type Confidence = "likely" | "possible";

export interface TriageInput {
  transport: "wifi" | "cellular" | "ethernet" | "unknown";
  /** User-entered or native-measured. Marked in evidence, never inferred. */
  wifiRssiDbm: number | null;
  cellularRsrpDbm: number | null;
  latencyMedianMs: number | null;
  jitterMs: number | null;
  failureRatePct: number | null;
  dnsMs: number | null;
  ttfbMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  survey?: Array<{ room: string; score: number | null; dbm: number | null }> | null;
  reportedProblem?: boolean;
}

export interface TriageAction {
  kind: "measure" | "guidance" | "settings";
  label: string;
  detail: string;
}

export interface Finding {
  cause: Cause;
  confidence: Confidence;
  title: string;
  explanation: string;
  evidence: string[];
  actions: TriageAction[];
}

export interface TriageResult {
  primary: Finding | null;
  findings: Finding[];
  missing: string[];
  summary: string;
  /** Never true: the engine does not claim to have fixed anything. */
  verifiedFix: false;
}

const REPEAT = (label = "Re-measure and compare"): TriageAction => ({
  kind: "measure",
  label,
  detail: "Run the quality test again after the change; the before/after comparison refuses to claim improvement inside measurement noise.",
});

export const SETTINGS_GUIDANCE: TriageAction[] = [
  {
    kind: "settings",
    label: "Open network settings yourself",
    detail:
      "PhoneCare never changes settings. Open Settings → Network & internet on your phone; on Android the app can deep-link to Wi-Fi and network-mode screens, but you tap the change.",
  },
  {
    kind: "guidance",
    label: "Wi-Fi Calling, if your carrier supports it",
    detail:
      "Wi-Fi Calling is controlled by the carrier and the OS. Turning it on can help indoors when cellular is weak, but it uses your Wi-Fi link, so fix that link first.",
  },
];

function fmt(value: number | null, unit: string, digits = 0): string {
  return value === null ? "not measured" : `${value.toFixed(digits)} ${unit}`;
}

export function triage(input: TriageInput): TriageResult {
  const findings: Finding[] = [];
  const missing: string[] = [];

  if (input.latencyMedianMs === null) missing.push("latency (run the quality test)");
  if (input.transport === "wifi" && input.wifiRssiDbm === null) {
    missing.push("Wi-Fi RSSI (enter it from your router/phone, or use the Android app)");
  }
  if (input.transport === "cellular" && input.cellularRsrpDbm === null) {
    missing.push("cellular RSRP (field-test screen or the Android app)");
  }

  const rssi = input.wifiRssiDbm;
  const rsrp = input.cellularRsrpDbm;
  const latency = input.latencyMedianMs;
  const jitter = input.jitterMs;
  const failures = input.failureRatePct;
  const dns = input.dnsMs;
  const ttfb = input.ttfbMs;
  const download = input.downloadMbps;

  const wifiWeak = rssi !== null && rssi < -75;
  const wifiStrong = rssi !== null && rssi >= -60;
  const cellWeak = rsrp !== null && rsrp < -105;
  const cellUsable = rsrp !== null && rsrp >= -95;
  const slowLink = latency !== null && latency > 150;

  // 1. Room-to-room difference, when a survey exists.
  const survey = (input.survey ?? []).filter((r) => r.score !== null || r.dbm !== null);
  if (survey.length >= 2) {
    const sorted = [...survey].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    const delta = (best.score ?? 0) - (worst.score ?? 0);
    if (best.score !== null && worst.score !== null && delta >= 25) {
      findings.push({
        cause: "room_specific",
        confidence: "likely",
        title: `The problem is location-specific: ${worst.room} is well behind ${best.room}`,
        explanation:
          "A large gap between rooms means the weak spot is about distance or obstructions to the access point, not the internet service.",
        evidence: [
          `${best.room}: score ${Math.round(best.score)}`,
          `${worst.room}: score ${Math.round(worst.score)}`,
          ...sorted.map((r) => `${r.room}: ${r.dbm !== null ? `${r.dbm} dBm` : "no dBm reading"}`).slice(0, 6),
        ],
        actions: [
          {
            kind: "measure",
            label: `Measure again in ${worst.room} and next to the router`,
            detail: "If the gap repeats, treat it as coverage. If both are slow, look upstream.",
          },
          {
            kind: "guidance",
            label: "Try a window, balcony or doorway test",
            detail:
              "Signal changes by several dB over a metre. Move the phone, not the router, first — it is the cheapest evidence.",
          },
          REPEAT(),
        ],
      });
    }
  }

  // 2. Weak Wi-Fi + usable cellular: the Wi-Fi coverage is the weak half.
  if (input.transport === "wifi" && wifiWeak && cellUsable) {
    findings.push({
      cause: "wifi_coverage",
      confidence: "likely",
      title: "Weak Wi-Fi coverage in this spot, with usable cellular",
      explanation:
        "The Wi-Fi link is the weaker of the two available paths. This is a coverage problem (distance, walls, band), not an internet problem.",
      evidence: [
        `Wi-Fi RSSI ${fmt(rssi, "dBm")} is below the −75 dBm weak threshold`,
        `Cellular RSRP ${fmt(rsrp, "dBm")} is usable, so the carrier signal is not the limit here`,
        `Latency ${fmt(latency, "ms")}, ${fmt(failures, "%", 1)} probe failures`,
      ],
      actions: [
        {
          kind: "guidance",
          label: "Compare 2.4 GHz and 5 GHz on the same router",
          detail:
            "5 GHz is faster but loses more through walls; 2.4 GHz reaches further at lower speeds. Test both in the problem room and keep whichever is measurably better there.",
        },
        {
          kind: "guidance",
          label: "Move the router, not the phone",
          detail:
            "Central, elevated and free of metal or water works best. Re-test the same room after moving it 1–2 metres.",
        },
        {
          kind: "guidance",
          label: "A mesh node is a coverage fix, not a speed fix",
          detail:
            "An extra node helps coverage, but each wireless hop costs throughput. Use a wired backhaul where possible.",
        },
        REPEAT(),
      ],
    });
  }

  // 3. Strong Wi-Fi, slow internet: upstream.
  if (input.transport === "wifi" && wifiStrong && slowLink) {
    findings.push({
      cause: "upstream",
      confidence: "likely",
      title: "The Wi-Fi link looks healthy; the delay is upstream",
      explanation:
        "With a strong local link, slow round trips point past the router: the internet connection, DNS, or congestion on the path.",
      evidence: [
        `Wi-Fi RSSI ${fmt(rssi, "dBm")} is strong`,
        `Latency ${fmt(latency, "ms")} exceeds 150 ms`,
        `Download ${fmt(download, "Mbps", 1)}`,
      ],
      actions: [
        {
          kind: "measure",
          label: "Run the test at a different time of day",
          detail: "Congestion peaks in the evening. Same server, same device, different hour is a fair comparison.",
        },
        {
          kind: "settings",
          label: "Reboot the router, then measure again",
          detail: "A reboot is a legitimate first step, but only a re-test tells you whether it changed anything.",
        },
        REPEAT("Measure after the reboot"),
      ],
    });
  }

  // 4. DNS latency with healthy first-byte time.
  if (dns !== null && dns > 100 && ttfb !== null && ttfb < 60 && (latency === null || latency > 60)) {
    findings.push({
      cause: "dns",
      confidence: "possible",
      title: "DNS resolution is slow compared with the connection itself",
      explanation:
        "Lookup time is high while the server's first byte arrives quickly, which matches slow name resolution rather than a slow link.",
      evidence: [`DNS lookup ${fmt(dns, "ms")}`, `Time to first byte ${fmt(ttfb, "ms")}`],
      actions: [
        {
          kind: "settings",
          label: "Check the DNS resolver configured on the router",
          detail:
            "Many routers let you set DNS servers. Change it in the router's own admin page, then re-measure. PhoneCare does not change it for you.",
        },
        REPEAT(),
      ],
    });
  }

  // 5. Weak cellular.
  if (input.transport === "cellular" && cellWeak) {
    findings.push({
      cause: "cellular_coverage",
      confidence: "likely",
      title: "Weak cellular coverage",
      explanation:
        "RSRP below −105 dBm means the modem is working with a marginal signal. The app cannot raise radio power; only location, the carrier, or a fixed approved booster can change this.",
      evidence: [`RSRP ${fmt(rsrp, "dBm")}`, `Latency ${fmt(latency, "ms")}`],
      actions: [
        {
          kind: "measure",
          label: "Test at a window or balcony",
          detail: "Signal is strongly position dependent indoors. Measure before and after moving.",
        },
        {
          kind: "guidance",
          label: "Wi-Fi Calling is the practical indoor workaround",
          detail:
            "If your carrier supports it, calls over a good Wi-Fi link will be more reliable than a marginal cellular signal.",
        },
        {
          kind: "settings",
          label: "Only use a carrier-approved, fixed booster",
          detail:
            "Consumer amplifiers that retransmit licensed spectrum are illegal in many countries and can harm the network. PhoneCare will never claim to amplify a signal.",
        },
        REPEAT(),
      ],
    });
  }

  // 6. Strong radio but low throughput: congestion or backhaul.
  if ((cellUsable || (wifiStrong && !slowLink)) && download !== null && download < 2) {
    findings.push({
      cause: "congestion",
      confidence: "possible",
      title: "Radio conditions are fine but throughput is very low",
      explanation:
        "Good signal with poor throughput usually means congestion, a backhaul limit, or a plan-level cap — not coverage.",
      evidence: [
        `Download ${fmt(download, "Mbps", 1)}`,
        `Latency ${fmt(latency, "ms")}, jitter ${fmt(jitter, "ms")}`,
        ...(rsrp !== null ? [`RSRP ${fmt(rsrp, "dBm")}`] : []),
        ...(rssi !== null ? [`Wi-Fi RSSI ${fmt(rssi, "dBm")}`] : []),
      ],
      actions: [
        {
          kind: "measure",
          label: "Repeat at another time and note the hour",
          detail: "Congestion is time dependent; two tests an hour apart are more informative than one.",
        },
        {
          kind: "settings",
          label: "Check your plan's data cap or throttling",
          detail: "Carrier apps show usage; PhoneCare does not have access to your account.",
        },
        REPEAT(),
      ],
    });
  }

  // 7. Jitter + failures: instability.
  if ((jitter !== null && jitter > 60) || (failures !== null && failures > 5)) {
    findings.push({
      cause: "instability",
      confidence: "likely",
      title: "The link is unstable, not just slow",
      explanation:
        "High jitter or repeated probe failures breaks calls and video even when the average speed looks acceptable.",
      evidence: [`Jitter ${fmt(jitter, "ms")}`, `Probe failures ${fmt(failures, "%", 1)}`],
      actions: [
        {
          kind: "guidance",
          label: "On Wi-Fi, change channel or band",
          detail:
            "2.4 GHz is crowded by neighbours and Bluetooth. Try 5 GHz or a less used channel from the router's admin page.",
        },
        {
          kind: "measure",
          label: "Run the longer stability series",
          detail: "Five probes per round for three rounds separates a blip from a pattern.",
        },
      ],
    });
  }

  // 8. Nothing wrong but the user still has a problem.
  if (findings.length === 0 && latency !== null && (download === null || download >= 2) && !slowLink) {
    findings.push({
      cause: "no_fault_found",
      confidence: "possible",
      title: "This test found no fault — which does not mean there is none",
      explanation: input.reportedProblem
        ? "The measurements look acceptable while you report a problem. That usually means the problem is intermittent, in one room, or in a single app."
        : "The measurements look acceptable at this moment. A one-off test cannot describe a link that varies.",
      evidence: [
        `Latency ${fmt(latency, "ms")}`,
        `Download ${fmt(download, "Mbps", 1)}`,
        `Jitter ${fmt(jitter, "ms")}`,
      ],
      actions: [
        {
          kind: "measure",
          label: "Run the test three times across the day",
          detail: "Compare the runs; the pattern matters more than any single number.",
        },
        {
          kind: "measure",
          label: "Do a room-by-room survey",
          detail: "If the problem is location-specific, the survey will show it.",
        },
      ],
    });
  }

  if (findings.length === 0) {
    findings.push({
      cause: "insufficient_data",
      confidence: "possible",
      title: "Not enough measurements to name a cause",
      explanation:
        "The engine only states a cause when the readings that support it exist. Run the quality test first.",
      evidence: [`Transport: ${input.transport}`],
      actions: [{ kind: "measure", label: "Run the quality test", detail: "Takes about half a minute and produces the numbers every other tool uses." }],
    });
  }

  const primary = findings[0] ?? null;
  return {
    primary,
    findings,
    missing,
    summary: primary ? primary.title : "No conclusion available.",
    verifiedFix: false,
  };
}
