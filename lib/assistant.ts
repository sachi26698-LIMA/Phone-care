import type { DiagnosticsState, ModuleId, Reading } from "@/lib/types";
import type { HealthSummary } from "@/lib/scoring";
import type { Recommendation } from "@/lib/recommendations";
import { MODULE_MAP } from "@/lib/modules";
import { GUIDE_MAP } from "@/lib/guides";

export interface AssistantReply {
  mode: "local" | "enhanced";
  title: string;
  paragraphs: string[];
  bullets: string[];
  caveats: string[];
  sources: { label: string; url: string }[];
  followUps: string[];
}

export interface AssistantContext {
  state: DiagnosticsState;
  health: HealthSummary;
  recommendations: Recommendation[];
}

function reading(state: DiagnosticsState, module: ModuleId, key: string): Reading | undefined {
  return state.modules[module]?.readings.find((r) => r.key === key);
}

function value(state: DiagnosticsState, module: ModuleId, key: string): string | null {
  const r = reading(state, module, key);
  return r?.value ?? null;
}

function num(state: DiagnosticsState, module: ModuleId, key: string): number | null {
  const r = reading(state, module, key);
  return r?.numeric ?? null;
}

function moduleLine(state: DiagnosticsState, module: ModuleId): string | null {
  const mod = state.modules[module];
  if (!mod) return null;
  return `${MODULE_MAP[module].title}: ${mod.summary}`;
}

export function suggestedQuestions(state: DiagnosticsState): string[] {
  const qs = ["What is the single most useful thing I should fix first?"];
  if (state.modules.battery) qs.push("How reliable is my battery health estimate?");
  if (state.modules.network) qs.push("Is my connection good enough for video calls?");
  if (state.modules.storage) qs.push("How much free storage should I keep?");
  if (state.modules.temperature) qs.push("Is my phone overheating?");
  if (state.modules.screen || state.modules.touch)
    qs.push("Could my screen or touch issues be hardware?");
  qs.push("What can a browser actually measure on my phone?");
  return qs.slice(0, 6);
}

function contextCaveats(ctx: AssistantContext): string[] {
  const caveats: string[] = [];
  const missing = (Object.keys(MODULE_MAP) as ModuleId[]).filter(
    (id) => !ctx.state.modules[id]?.completedAt,
  );
  if (missing.length > 0) {
    caveats.push(
      `Not yet scanned: ${missing.map((id) => MODULE_MAP[id].short).join(", ")}. Advice improves with more data.`,
    );
  }
  if (ctx.health.confidence < 60 && ctx.health.runModules > 0) {
    caveats.push(
      `Evidence coverage is ${ctx.health.confidence}%. Some values are estimates or unavailable in this browser.`,
    );
  }
  return caveats;
}

function sourceList(slugs: string[]) {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  for (const slug of slugs) {
    const guide = GUIDE_MAP.get(slug);
    for (const source of guide?.sources ?? []) {
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      out.push(source);
    }
  }
  return out.slice(0, 3);
}

export function answerQuestion(question: string, ctx: AssistantContext): AssistantReply {
  const q = question.toLowerCase();
  const base = { mode: "local" as const, caveats: contextCaveats(ctx) };

  const has = (words: string[]) => words.some((w) => q.includes(w));

  if (has(["battery", "charge", "drain", "health"])) {
    const level = value(ctx.state, "battery", "level");
    const health = num(ctx.state, "battery", "health-estimate");
    const charging = value(ctx.state, "battery", "charging");
    const cycles = num(ctx.state, "battery", "cycles");
    const paragraphs: string[] = [];

    if (!ctx.state.modules.battery?.completedAt) {
      paragraphs.push(
        "I do not have a battery scan from this device yet. Run the battery module — it takes about a second and needs no permissions.",
      );
    } else if (health != null) {
      paragraphs.push(
        `Your estimated battery health is ${health.toFixed(0)}%. That figure is calculated from the design and full-charge capacities you entered, so its accuracy depends entirely on how you read those numbers.`,
      );
      if (health < 80) {
        paragraphs.push(
          "Below 80% is the conventional service threshold. Expect shorter runtime, and possibly sudden shutdowns at low percentages, because a worn cell struggles to deliver peak current.",
        );
      } else if (health < 90) {
        paragraphs.push(
          "That is normal ageing, not a fault. Most phones sit in the high 80s after two to three years of use.",
        );
      } else {
        paragraphs.push("That is healthy for a used cell. Keep heat down and it should stay in this range for a while.");
      }
    } else {
      paragraphs.push(
        `Charge level is ${level ?? "not readable in this browser"}${charging ? `, ${charging.toLowerCase()}` : ""}. Battery health cannot be read by any web API — browsers expose level and charging state only.`,
      );
      paragraphs.push(
        "If you want a health estimate, open Settings → Battery on your phone, note design capacity and current full-charge capacity, and enter both in the battery module. PhoneCare will compute capacity retention and label it clearly as an estimate.",
      );
    }

    const bullets: string[] = [];
    if (level) bullets.push(`Current level: ${level}${charging ? ` · ${charging}` : ""}.`);
    if (cycles != null) bullets.push(`Reported cycle count: ${cycles}.`);
    if (health != null) bullets.push("Treat the health percentage as capacity retention, not remaining runtime.");
    bullets.push("Heat is the biggest accelerant of capacity loss — more than fast charging on its own.");

    return {
      ...base,
      title: "Battery analysis",
      paragraphs,
      bullets,
      sources: sourceList(["battery-health-decline"]),
      followUps: [
        "What should I do if my battery health is under 80%?",
        "Why can't any website read battery capacity?",
      ],
    };
  }

  if (has(["storage", "space", "disk", "full", "memory"])) {
    const free = num(ctx.state, "storage", "device-free");
    const originUsage = value(ctx.state, "storage", "origin-usage");
    const paragraphs: string[] = [];
    if (free == null) {
      paragraphs.push(
        "I cannot see your device's disk from the browser — that is a deliberate platform restriction. The storage module can measure this site's browser quota only.",
      );
      paragraphs.push(
        "Enter total and free gigabytes from Settings → Storage and re-run the module. Then the advice becomes specific instead of generic.",
      );
    } else if (free < 7) {
      paragraphs.push(
        `With about ${free.toFixed(0)}% free, your phone is under real pressure. The OS needs headroom for caches, OTA updates and swap; below roughly 7% you get slow launches, failed camera saves and update failures.`,
      );
    } else if (free < 15) {
      paragraphs.push(
        `${free.toFixed(0)}% free is workable but tight. Aim for 15% or more so background maintenance is not competing for space.`,
      );
    } else {
      paragraphs.push(
        `${free.toFixed(0)}% free is a healthy margin. Storage pressure is not contributing to any performance problem you are seeing.`,
      );
    }

    return {
      ...base,
      title: "Storage read-out",
      paragraphs,
      bullets: [
        free != null ? `Device free space: ${free.toFixed(0)}% (from your input).` : "Device free space: unavailable to the browser.",
        originUsage ? `Browser origin usage: ${originUsage}.` : "",
        "Target at least 15% free; treat under 7% as urgent.",
        "Photos, videos and chat-app media caches recover the most space fastest.",
      ].filter(Boolean),
      sources: sourceList(["storage-full"]),
      followUps: ["What is the fastest safe way to free up space?", "Why does the browser hide my disk usage?"],
    };
  }

  if (has(["network", "wifi", "wi-fi", "internet", "speed", "latency", "ping", "call", "lag", "stream"])) {
    const down = num(ctx.state, "network", "download");
    const up = num(ctx.state, "network", "upload");
    const latency = num(ctx.state, "network", "latency");
    const paragraphs: string[] = [];
    if (down == null && latency == null) {
      paragraphs.push(
        "No network measurement yet. Run the network module: it takes a few seconds and transfers a capped test payload from this site.",
      );
    } else {
      if (down != null && latency != null) {
        paragraphs.push(
          `You measured ${down.toFixed(1)} Mbps down, ${up != null ? `${up.toFixed(1)} Mbps up, ` : ""}and ${latency} ms median latency.`,
        );
        if (latency > 150) {
          paragraphs.push(
            "Latency is the limiting factor here. For calls and gaming, 150 ms+ round-trip feels laggy even when raw throughput is high.",
          );
        } else if (down < 8) {
          paragraphs.push(
            "Throughput is on the low side. Video calls usually need 3–5 Mbps each way; 8 Mbps down leaves little headroom for other devices.",
          );
        } else if (down >= 25 && latency <= 80) {
          paragraphs.push(
            "That combination comfortably supports HD video calls, streaming and normal browsing. If something still feels slow, the bottleneck is likely the app or the server, not the link.",
          );
        }
      }
      paragraphs.push(
        "One caveat: these numbers are measured against PhoneCare's own host, so distance and server response time are included. Compare runs from the same place and network rather than against a carrier's advertised speed.",
      );
    }

    return {
      ...base,
      title: "Network assessment",
      paragraphs,
      bullets: [
        down != null ? `Download: ${down.toFixed(1)} Mbps (measured).` : "",
        up != null ? `Upload: ${up.toFixed(1)} Mbps (measured).` : "",
        latency != null ? `Latency: ${latency} ms median, six probes.` : "",
        "Video calls care about latency and jitter more than peak speed.",
      ].filter(Boolean),
      sources: sourceList(["slow-wifi"]),
      followUps: ["How do I tell if it is my router or my carrier?", "Why is my upload speed so much lower than download?"],
    };
  }

  if (has(["heat", "hot", "temperature", "thermal", "throttl", "warm"])) {
    const throttle = value(ctx.state, "temperature", "throttle");
    const paragraphs: string[] = [];
    paragraphs.push(
      "No browser can read your phone's temperature, including PhoneCare. Anything presented as a live temperature from a website is either user input or an inference.",
    );
    if (throttle) {
      paragraphs.push(
        `Your sustained-load test reported: ${throttle.toLowerCase()}. That is derived by comparing throughput across benchmark rounds — a throttling signal, not a thermometer.`,
      );
      paragraphs.push(
        "If the phone also feels warm to the touch, reduce the two stacked heat sources first: charging and heavy apps at the same time, and thick cases.",
      );
    } else {
      paragraphs.push(
        "Run the thermal module to test for throttling under load. It takes about five seconds. For an actual temperature reading, use your phone's built-in diagnostics.",
      );
    }
    return {
      ...base,
      title: "Thermal state",
      paragraphs,
      bullets: [
        "Temperature itself: unavailable to all web pages.",
        "Throttling signal: estimated from sustained benchmark rounds.",
        "Persistent heat at rest or a bulging case is a hardware safety issue — stop using the device.",
      ],
      sources: sourceList(["overheating"]),
      followUps: ["Could heat be causing my slow performance?", "What temperature is dangerous for a phone battery?"],
    };
  }

  if (has(["slow", "performance", "lag", "fps", "stutter", "freez", "responsive"])) {
    const fps = num(ctx.state, "performance", "fps");
    const compute = num(ctx.state, "performance", "compute");
    const paragraphs: string[] = [];
    if (fps == null) {
      paragraphs.push(
        "I do not have a performance profile yet. Run the performance module — it measures frame cadence, compute throughput and browser storage speed in about three seconds.",
      );
    } else {
      paragraphs.push(
        `This session sampled ${fps} fps with a compute index of ${compute ?? "—"} Mops/s. Both are relative to this device and session, not universal scores.`,
      );
      paragraphs.push(
        "Before blaming the hardware, check the three usual causes in order: free storage below 15%, thermal throttling, and background apps. Those explain most 'slow phone' reports on devices that are otherwise fine.",
      );
    }
    return {
      ...base,
      title: "Performance triage",
      paragraphs,
      bullets: [
        "Clear storage to 15%+ free first — cheapest and largest effect.",
        "A warm phone throttles deliberately; let it cool and re-test.",
        "Disable auto-start for apps you do not need instant alerts from.",
        "PhoneCare's index is session-relative; it is not a hardware verdict.",
      ],
      sources: sourceList(["slow-phone-performance"]),
      followUps: ["Which is more likely: storage or heat?", "Is my phone too old for current apps?"],
    };
  }

  if (has(["screen", "display", "pixel", "touch", "dead zone", "ghost"])) {
    const failed = (ctx.state.modules.screen?.readings ?? []).filter(
      (r) => r.key.startsWith("check-") && r.status === "bad",
    );
    const coverage = num(ctx.state, "touch", "coverage");
    const paragraphs: string[] = [];
    paragraphs.push(
      failed.length > 0
        ? `You reported ${failed.length} failed visual check${failed.length > 1 ? "s" : ""}. Panel-level defects do not heal with software, but they should be documented before you ask for a repair.`
        : "No screen defects have been recorded in this session. The guided screen test is the fastest way to check for uniform colour, stuck pixels and banding.",
    );
    if (coverage != null) {
      paragraphs.push(
        `Your touch trace covered ${coverage}% of the grid. Gaps only indicate a fault if the same region fails on a repeat run — one pass often just misses corners.`,
      );
    } else {
      paragraphs.push(
        "For touch, run the guided trace twice. Comparing two passes separates technique from a genuine dead band.",
      );
    }
    return {
      ...base,
      title: "Display and touch",
      paragraphs,
      bullets: [
        "A screenshot shows software; your camera shows panel faults — use both as evidence.",
        "Clean the screen and remove thick protectors before testing touch.",
        "Ghost touches that stop when unplugged usually mean a bad charger.",
      ],
      sources: sourceList(["screen-defects", "touchscreen-issues"]),
      followUps: ["How do I document a screen defect for a warranty claim?", "What causes ghost touches while charging?"],
    };
  }

  if (has(["privacy", "data", "safe", "upload", "server", "store", "gdpr"])) {
    return {
      ...base,
      title: "Privacy and data handling",
      paragraphs: [
        "PhoneCare runs diagnostics inside your browser. Readings are not sent to a server, and there is no account, analytics profile or advertising identifier.",
        "Your scan history is stored in this browser's localStorage so results survive a refresh. Clearing site data removes it permanently.",
        "The only network requests PhoneCare makes are to its own endpoints for the speed test and, if configured by the operator, an optional assistant proxy. No third-party IP, analytics or advertising services are contacted.",
      ],
      bullets: [
        "No diagnostics uploaded.",
        "No API keys in client-side code.",
        "Network tests transfer capped payloads to this site only.",
      ],
      sources: sourceList(["browser-diagnostics-limits"]),
      followUps: ["How do I delete my scan history?", "What does the optional AI integration send?"],
    };
  }

  if (has(["what can", "browser", "measure", "unavailable", "why can't", "why cant", "limit", "accurate", "reliable"])) {
    return {
      ...base,
      title: "The honest limits of browser diagnostics",
      paragraphs: [
        "A website can measure display geometry, pixel density, touch points, feature support, network throughput, frame timing and compute speed. In Chromium it can also read battery level and charging state.",
        "It cannot read battery health, battery temperature, cycle count, CPU temperature, fan speed, or total disk usage. Safari and Firefox withhold battery and memory data entirely as an anti-fingerprinting measure.",
        "That is why every PhoneCare reading is labelled Measured, Estimated, or You provided. If a value is not obtainable, the app says so instead of showing a plausible-looking number.",
      ],
      bullets: [
        "Measured: geometry, touch, throughput, frame timing, feature detection.",
        "Estimated: battery health, thermal pressure, connection class.",
        "Unavailable: all temperatures, voltage, cycle count, disk usage.",
      ],
      sources: sourceList(["browser-diagnostics-limits"]),
      followUps: ["Which browser gives the most readings?", "How is battery health estimated?"],
    };
  }

  if (has(["replace", "repair", "buy", "new phone", "worth"])) {
    const health = num(ctx.state, "battery", "health-estimate");
    const overall = ctx.health.overall;
    const critical = ctx.recommendations.filter((r) => r.severity === "critical");
    return {
      ...base,
      title: "Repair or replace?",
      paragraphs: [
        critical.length > 0
          ? `There ${critical.length === 1 ? "is one critical finding" : `are ${critical.length} critical findings`}: ${critical.map((c) => c.title.toLowerCase()).join("; ")}.`
          : "No critical findings are logged in this session.",
        overall != null
          ? `The weighted health index is ${overall}/100 across the modules you have run. That is a maintenance signal, not a valuation of the device.`
          : "Run the full scan to get a weighted index; without data the honest answer is that there is not enough evidence.",
        health != null && health < 80
          ? "If the only problem is the battery and you otherwise like the phone, a quality battery replacement is almost always cheaper than a new device."
          : "If storage, battery and performance all score poorly together, the cost of parts plus labour often approaches the value of the phone.",
        "Get a written quote with a warranty, and back up before handing the device over.",
      ],
      bullets: [
        "A single failing part is usually worth repairing.",
        "Multiple worn subsystems on a 4+ year old device usually favour replacement.",
        "Never accept an unofficial battery without asking about thermal sensors and warranty.",
      ],
      sources: sourceList(["battery-health-decline", "slow-phone-performance"]),
      followUps: ["How much battery health loss justifies replacement?", "What should I check before buying a used phone?"],
    };
  }

  if (has(["report", "summary", "overall", "score", "result", "everything"])) {
    const lines: string[] = [];
    (Object.keys(MODULE_MAP) as ModuleId[]).forEach((id) => {
      const line = moduleLine(ctx.state, id);
      if (line) lines.push(line);
    });
    return {
      ...base,
      title: "Diagnostic report summary",
      paragraphs: [
        ctx.health.overall != null
          ? `Weighted health index: ${ctx.health.overall}/100, built from ${ctx.health.scorableModules} scored module${ctx.health.scorableModules === 1 ? "" : "s"} with ${ctx.health.confidence}% evidence coverage.`
          : "No module has produced a justifiable score yet. Run the scan to populate the report.",
        ctx.recommendations.length > 0
          ? `There ${ctx.recommendations.length === 1 ? "is 1 recommendation" : `are ${ctx.recommendations.length} recommendations`}, led by: ${ctx.recommendations[0]?.title}.`
          : "No recommendations are logged. Either everything looks healthy, or too little has been measured.",
      ],
      bullets: lines.slice(0, 9),
      sources: sourceList(["browser-diagnostics-limits"]),
      followUps: ["What is my biggest risk right now?", "Give me a one-week action plan."],
    };
  }

  if (has(["plan", "action", "fix", "first", "priority", "next"])) {
    const top = ctx.recommendations.slice(0, 4);
    return {
      ...base,
      title: "Your prioritised action plan",
      paragraphs: [
        top.length > 0
          ? "These are ordered by impact and cost, using the evidence available from your scan."
          : "I have no findings to prioritise yet. Run the full scan, then ask again.",
      ],
      bullets: top.length
        ? top.map((r, i) => `${i + 1}. ${r.title} — ${r.actions[0] ?? r.body}`)
        : ["Run the full scan from the dashboard."],
      sources: sourceList(top.map((t) => t.guide).filter((g): g is string => Boolean(g))),
      followUps: ["Why is that the priority?", "What can I fix without spending money?"],
    };
  }

  return {
    ...base,
    title: "Here is what I can tell you from this scan",
    paragraphs: [
      ctx.health.overall != null
        ? `Your weighted health index is ${ctx.health.overall}/100 from ${ctx.health.scorableModules} scored modules, with ${ctx.health.confidence}% evidence coverage.`
        : "No scored modules yet — run the full scan to give me something to reason about.",
      ctx.recommendations.length > 0
        ? `The strongest finding is: ${ctx.recommendations[0]?.title}. ${ctx.recommendations[0]?.body ?? ""}`
        : "No findings are currently logged.",
      "Ask me about battery, storage, network, heat, performance, the display, privacy, or what a browser genuinely can and cannot measure.",
    ],
    bullets: [
      ctx.recommendations.slice(0, 3).map((r) => `${r.severity === "critical" ? "Priority" : "Note"}: ${r.title}`).join(" · "),
      "Every answer is generated locally from your readings and the PhoneCare guide library.",
    ].filter(Boolean),
    sources: sourceList(["browser-diagnostics-limits"]),
    followUps: suggestedQuestions(ctx.state),
  };
}

/** Short, scannable briefing used on the dashboard. */
export function buildBriefing(ctx: AssistantContext): {
  headline: string;
  body: string;
  bullets: string[];
  confidence: number;
} {
  const { state, health, recommendations } = ctx;
  if (health.runModules === 0) {
    return {
      headline: "Your device is unexamined.",
      body: "Run the full scan and PhoneCare will build a weighted picture of battery, storage, network, thermal and performance signals — with every reading labelled by how it was obtained.",
      bullets: [
        "Nine modules, about 30 seconds plus two guided checks.",
        "No permissions, no account, no uploads.",
        "Unavailable metrics are shown as unavailable, not guessed.",
      ],
      confidence: 0,
    };
  }

  const top = recommendations[0];
  const strongest = health.strongest[0];
  const weakest = health.weakest[0];

  const headline =
    health.provisional
      ? "Early signal, not a verdict yet."
      : health.overall == null
        ? "Scan complete, but not enough verified data to score."
      : health.overall >= 85
        ? "This device looks healthy."
        : health.overall >= 70
          ? "Mostly healthy, with a few things worth watching."
          : health.overall >= 50
            ? "Some systems need attention."
            : "Multiple signals need attention.";

  const parts: string[] = [];
  if (health.provisional) {
    parts.push(
      health.scorableModules === 0
        ? `No module has produced a score yet; evidence coverage is ${health.confidence}%. Run the remaining modules before treating anything here as a health verdict.`
        : `Only ${health.scorableModules} module${health.scorableModules === 1 ? "" : "s"} ${health.scorableModules === 1 ? "has" : "have"} produced a score and evidence coverage is ${health.confidence}%. Run the remaining modules before treating this as a health verdict.`,
    );
  } else {
    if (weakest) {
      parts.push(
        `Weakest area: ${MODULE_MAP[weakest.id].title}${weakest.score != null ? ` at ${weakest.score}/100` : ""}.`,
      );
    }
    if (strongest && strongest.id !== weakest?.id) {
      parts.push(`Strongest: ${MODULE_MAP[strongest.id].title}.`);
    }
    parts.push(`Evidence coverage is ${health.confidence}%.`);
  }

  const bullets = [...parts];
  if (top && top.severity === "tip") {
    bullets.push(`Suggestion: ${top.title}`);
  }

  return {
    headline,
    body:
      top && top.severity !== "tip"
        ? `${parts.join(" ")} ${top.title}. ${top.body}`
        : parts.join(" "),
    bullets,
    confidence: health.confidence,
  };
}
