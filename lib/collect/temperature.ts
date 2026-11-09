import type { ModuleResult, Reading, UserProfile } from "@/lib/types";
import { makeResult } from "@/lib/collect/common";
import { runComputeBenchmark, sampleFrames } from "@/lib/collect/performance";
import { clamp } from "@/lib/utils";

export interface SustainedLoadResult {
  rounds: number[];
  degradationPct: number;
  avgFpsUnderLoad: number;
  verdict: "stable" | "moderate" | "heavy";
}

/**
 * Runs three sustained compute rounds. The first is a JIT warm-up and is
 * discarded; the drop from round two to round three is used as a throttling
 * signal. That is an *inference*: no browser can read a thermometer.
 */
export async function runSustainedLoad(
  onProgress?: (progress: number, label: string) => void,
): Promise<SustainedLoadResult> {
  const rounds: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    onProgress?.((i / 3) * 80, `Load round ${i + 1} of 3`);
    rounds.push(runComputeBenchmark(4_000_000));
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  onProgress?.(85, "Sampling frame cadence");
  const frames = await sampleFrames(900);
  onProgress?.(100, "Inference complete");

  const [, second, third] = rounds;
  const degradationPct =
    second && third ? clamp(((second - third) / second) * 100, -20, 80) : 0;

  const verdict: SustainedLoadResult["verdict"] =
    degradationPct > 22 ? "heavy" : degradationPct > 9 ? "moderate" : "stable";

  return { rounds, degradationPct, avgFpsUnderLoad: frames.fps, verdict };
}

export function collectTemperature(
  profile: UserProfile,
  load: SustainedLoadResult,
  ambientTempC?: number,
): ModuleResult {
  const readings: Reading[] = [];
  const notes: string[] = [];

  readings.push({
    key: "sensor",
    label: "Device temperature sensor",
    value: null,
    evidence: "unavailable",
    source: "Web platform",
    detail:
      "There is no web API that exposes battery, CPU or skin temperature. Android and iOS restrict it to native apps with device-level access.",
  });

  readings.push({
    key: "throttle",
    label: "Thermal throttling signal",
    value:
      load.verdict === "stable"
        ? "No measurable throttling"
        : load.verdict === "moderate"
          ? "Mild performance drop under load"
          : "Significant drop under load",
    evidence: "estimated",
    source: "Three-round sustained compute benchmark",
    detail: `Round 2 → 3 throughput changed ${load.degradationPct > 0 ? "−" : "+"}${Math.abs(load.degradationPct).toFixed(1)}%. A drop can come from thermal throttling, a power/current limit, or the browser deprioritising the tab.`,
    status: load.verdict === "stable" ? "good" : load.verdict === "moderate" ? "warn" : "bad",
    numeric: Math.round(load.degradationPct),
  });

  // A backgrounded or headless tab samples rAF at a few fps. Reporting that as a
  // thermal frame-rate limit would be false, so only publish plausible samples.
  const fpsUsable = load.avgFpsUnderLoad >= 20;
  readings.push({
    key: "fps-load",
    label: "Frame cadence under load",
    value: fpsUsable ? `${load.avgFpsUnderLoad.toFixed(0)} fps` : null,
    evidence: fpsUsable ? "measured" : "unavailable",
    source: "requestAnimationFrame during load",
    detail: fpsUsable
      ? "Sustained heavy work is the harshest realistic test of a phone's thermal headroom while browsing."
      : `Only ${load.avgFpsUnderLoad.toFixed(0)} fps were sampled, which happens when a tab is hidden or throttled. The throttling verdict above is unaffected.`,
    status: fpsUsable
      ? load.avgFpsUnderLoad >= 45
        ? "good"
        : load.avgFpsUnderLoad >= 28
          ? "warn"
          : "bad"
      : "neutral",
    numeric: fpsUsable ? Math.round(load.avgFpsUnderLoad) : undefined,
  });

  const ambient = ambientTempC ?? profile.ambientTempC;
  if (ambient != null && Number.isFinite(ambient)) {
    const status = ambient < 0 || ambient > 35 ? "warn" : "good";
    readings.push({
      key: "ambient",
      label: "Ambient temperature",
      value: `${ambient.toFixed(0)} °C`,
      evidence: "user",
      source: "You provided",
      detail:
        "Ambient heat changes how quickly a phone sheds its own heat. Charging or gaming in a hot room accelerates wear.",
      status,
      numeric: ambient,
    });
  }

  const measuredTemp = profile.measuredDeviceTempC;
  if (measuredTemp != null && Number.isFinite(measuredTemp)) {
    readings.push({
      key: "user-temp",
      label: "Temperature you read on-device",
      value: `${measuredTemp.toFixed(1)} °C`,
      evidence: "user",
      source: "You provided",
      detail:
        "PhoneCare cannot verify this number. It is shown alongside manufacturer guidance ranges for battery safety.",
      status: measuredTemp > 45 ? "bad" : measuredTemp > 40 ? "warn" : "good",
      numeric: measuredTemp,
    });
  }

  notes.push(
    "A short benchmark can only rule out severe throttling. Phones usually start throttling after 5–15 minutes of sustained gaming or navigation.",
  );
  if (!fpsUsable) {
    notes.push(
      "Frame cadence could not be judged because the tab was throttled during the test. Keep it visible and re-run if you want that signal.",
    );
  }
  if (load.verdict === "heavy") {
    notes.push(
      "If the device is also warm to the touch, close heavy apps, stop charging while gaming, and remove a thick case. Persistent heat after cooldown can indicate a failing battery.",
    );
  }

  const score =
    load.verdict === "stable" ? 88 : load.verdict === "moderate" ? 68 : 44;

  return makeResult("temperature", {
    status: "partial",
    score,
    coverage: 0.4,
    readings,
    summary:
      load.verdict === "stable"
        ? "No throttling detected under sustained load. Temperature itself is not readable by any browser."
        : `Sustained load caused a ${Math.abs(load.degradationPct).toFixed(0)}% throughput drop — a throttling indicator, not a temperature reading.`,
    notes,
    durationMs: 0,
  });
}
