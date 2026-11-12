import type { DiagnosticsState, ModuleId, ModuleResult, Reading } from "@/lib/types";

export type Severity = "critical" | "attention" | "tip";

export interface Recommendation {
  id: string;
  severity: Severity;
  module: ModuleId;
  title: string;
  body: string;
  actions: string[];
  evidence: string;
  guide?: string;
}

function find(module: ModuleResult | undefined, key: string): Reading | undefined {
  return module?.readings.find((r) => r.key === key);
}

function healthPct(module: ModuleResult | undefined): number | null {
  const estimate = find(module, "health-estimate");
  if (estimate?.numeric != null) return estimate.numeric;
  return null;
}

export function buildRecommendations(state: DiagnosticsState): Recommendation[] {
  const recs: Recommendation[] = [];
  const battery = state.modules.battery;
  const storage = state.modules.storage;
  const network = state.modules.network;
  const temperature = state.modules.temperature;
  const performance = state.modules.performance;
  const screen = state.modules.screen;
  const touch = state.modules.touch;
  const compatibility = state.modules.compatibility;

  const health = healthPct(battery);
  if (health != null && health < 80) {
    recs.push({
      id: "battery-service",
      severity: "critical",
      module: "battery",
      title: "Battery has passed the typical replacement threshold",
      body: `Your estimated capacity is ${health.toFixed(0)}% of the original design. Most manufacturers treat 80% as the point where runtime and peak-power delivery become unreliable.`,
      actions: [
        "Back up photos and chat history before any repair.",
        "Get a quote from an authorised service centre; aftermarket cells vary widely in quality.",
        "Until then, enable battery saver below 30% and avoid heavy gaming while charging.",
      ],
      evidence: `Estimated from entered capacities (${state.profile.batteryFullChargeCapacityMah ?? "?"} / ${state.profile.batteryDesignCapacityMah ?? "?"} mAh).`,
      guide: "battery-health-decline",
    });
  } else if (health != null && health < 88) {
    recs.push({
      id: "battery-aging",
      severity: "attention",
      module: "battery",
      title: "Battery is ageing but still serviceable",
      body: `Estimated capacity is ${health.toFixed(0)}%. Expect slightly shorter screen-on time than when the phone was new.`,
      actions: [
        "Keep charge between 20% and 85% where practical.",
        "Avoid leaving the phone at 100% on a charger overnight in a hot room.",
      ],
      evidence: `Estimated from entered capacities.`,
      guide: "battery-health-decline",
    });
  }

  const pages = (battery?.readings ?? []).find((r) => r.key === "cycles");
  if (pages?.numeric != null && pages.numeric > 800) {
    recs.push({
      id: "battery-cycles",
      severity: "attention",
      module: "battery",
      title: "High charge-cycle count",
      body: `You reported ${pages.numeric} cycles. Lithium-ion phone cells typically retain 80% capacity for roughly 500–1000 full cycles.`,
      actions: ["Watch for sudden shutdowns below 20% — that is a common end-of-life symptom."],
      evidence: "Entered by you from on-device battery information.",
      guide: "battery-health-decline",
    });
  }

  const free = find(storage, "device-free");
  if (free?.numeric != null && free.numeric < 7) {
    recs.push({
      id: "storage-critical",
      severity: "critical",
      module: "storage",
      title: "Storage is nearly full",
      body: `${free.numeric.toFixed(0)}% free space can block OS updates, slow app launches and stop the camera from saving photos.`,
      actions: [
        "Offload photos and videos to cloud or a computer, then delete local copies.",
        "Clear cached media inside messaging apps — these often hide several GB.",
        "Remove unused apps; most leave data behind unless uninstalled.",
      ],
      evidence: "Based on device totals you entered, cross-checked against OS thresholds.",
      guide: "storage-full",
    });
  } else if (free?.numeric != null && free.numeric < 15) {
    recs.push({
      id: "storage-watch",
      severity: "attention",
      module: "storage",
      title: "Free space is getting tight",
      body: `${free.numeric.toFixed(0)}% of your device storage is free. Below 15%, background maintenance has less room to work.`,
      actions: ["Clear cached downloads and unused offline maps.", "Check which apps grew most in the last month."],
      evidence: "Based on device totals you entered.",
      guide: "storage-full",
    });
  }

  const download = find(network, "download");
  if (download?.numeric != null && download.numeric < 8) {
    recs.push({
      id: "network-slow",
      severity: "attention",
      module: "network",
      title: "Measured download speed is low",
      body: `PhoneCare measured ${download.numeric.toFixed(1)} Mbps against this site. Video calls and app updates will feel sluggish at this rate.`,
      actions: [
        "Re-test on Wi-Fi, then on mobile data, to isolate the link.",
        "Move closer to the router; 5 GHz reaches less far than 2.4 GHz.",
        "Rule out a VPN or Data Saver before blaming the carrier.",
      ],
      evidence: "Same-origin payload transfer measured in this session.",
      guide: "slow-wifi",
    });
  }

  const latency = find(network, "latency");
  if (latency?.numeric != null && latency.numeric > 150) {
    recs.push({
      id: "network-latency",
      severity: "attention",
      module: "network",
      title: "High round-trip latency",
      body: `${latency.numeric} ms median latency explains lag in games and calls even when raw speed looks fine.`,
      actions: [
        "Disable a VPN or proxy and re-test.",
        "Check whether other devices on the network are saturating the uplink.",
      ],
      evidence: "Median of six HTTPS probes from this browser.",
      guide: "slow-wifi",
    });
  }

  if (
    temperature?.status === "partial" &&
    find(temperature, "throttle")?.status !== "good"
  ) {
    const throttle = find(temperature, "throttle");
    recs.push({
      id: "thermal",
      severity: find(temperature, "throttle")?.status === "bad" ? "attention" : "tip",
      module: "temperature",
      title: "Performance dips under sustained load",
      body:
        "Throughput fell noticeably across benchmark rounds. That points to thermal or power limiting — not a temperature measurement, which browsers cannot provide.",
      actions: [
        "Remove the case while gaming or navigating for long periods.",
        "Avoid charging and gaming at the same time.",
        "Re-run after 10 minutes of cool-down to see whether the drop persists.",
      ],
      evidence: throttle?.value ?? "Sustained-load benchmark comparison.",
      guide: "overheating",
    });
  }

  if (performance?.score != null && performance.score < 55) {
    recs.push({
      id: "performance-low",
      severity: "attention",
      module: "performance",
      title: "Performance profile is below par",
      body: "Compute or frame-cadence results were low for this session. That can reflect entry-level hardware, background load, or power saving.",
      actions: [
        "Close heavy background apps and re-run the performance scan.",
        "Turn off battery saver, which often caps refresh rate and CPU clocks.",
        "Restart the phone if it has been running for weeks.",
      ],
      evidence: "Frame cadence and compute benchmark in this session.",
      guide: "slow-phone-performance",
    });
  }

  const failedChecks = (screen?.readings ?? []).filter(
    (r) => r.key.startsWith("check-") && r.status === "bad",
  );
  if (failedChecks.length > 0) {
    recs.push({
      id: "screen-defect",
      severity: "attention",
      module: "screen",
      title: "Visual defects reported during the screen test",
      body: `${failedChecks.length} pattern check${failedChecks.length > 1 ? "s" : ""} failed. Uniformity, stuck pixels and banding are hardware-level issues software cannot fix.`,
      actions: [
        "Take a screenshot — if the defect appears in the screenshot, it may be software; if not, it is the panel.",
        "Restart in safe mode to rule out an overlay app.",
        "If the defect persists, get a repair estimate.",
      ],
      evidence: "Your confirmations during the guided screen test.",
      guide: "screen-defects",
    });
  }

  const coverage = find(touch, "coverage");
  if (coverage?.numeric != null && coverage.numeric < 97) {
    recs.push({
      id: "touch-coverage",
      severity: "tip",
      module: "touch",
      title: "Touch grid has untouched zones",
      body: `${coverage.numeric}% of the grid registered input. Gaps only matter if they repeat in the same area across runs.`,
      actions: [
        "Clean the screen and remove any thick screen protector.",
        "Run the trace again, slowly, covering the reported zones.",
        "If the same band is dead twice, it is likely a digitiser fault.",
      ],
      evidence: "Zone coverage measured from your trace.",
      guide: "touchscreen-issues",
    });
  }

  const tier = find(compatibility, "tier");
  if (tier && tier.status !== "good") {
    recs.push({
      id: "compat-limited",
      severity: "tip",
      module: "compatibility",
      title: "This browser exposes fewer hardware signals",
      body: "Some readings are unavailable because of browser privacy policy, not a fault with your phone. Safari and Firefox deliberately withhold several APIs.",
      actions: [
        "Use Chrome, Edge, Opera or Samsung Internet on Android for the widest coverage.",
        "On iPhone, no browser choice will change this — all iOS browsers use WebKit.",
      ],
      evidence: tier.value ? `${tier.value} capability tier.` : "Feature detection results.",
      guide: "browser-diagnostics-limits",
    });
  }

  if (state.profile.storageTotalGb == null && storage?.completedAt) {
    recs.push({
      id: "storage-input",
      severity: "tip",
      module: "storage",
      title: "Add your device storage totals for a real analysis",
      body: "Browsers hide disk usage. Two numbers from Settings → Storage unlock the storage-pressure model.",
      actions: ["Enter total and free GB in the storage module and re-run it."],
      evidence: "Missing user-provided data.",
      guide: "storage-full",
    });
  }

  const rank: Record<Severity, number> = { critical: 0, attention: 1, tip: 2 };
  return recs.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
