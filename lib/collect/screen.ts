import type { DisplayMeasurement, ModuleResult, Reading } from "@/lib/types";
import { makeResult, median } from "@/lib/collect/common";

export interface UserCheck {
  id: string;
  label: string;
  passed: boolean;
}

export function measureDisplay(): Promise<DisplayMeasurement> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - start < 900) {
        requestAnimationFrame(tick);
        return;
      }
      const med = median(deltas.slice(1));
      let hz: number | null = null;
      if (med > 0) {
        const raw = 1000 / med;
        // A backgrounded or throttled tab can drop below 10 fps; reporting that
        // as a "refresh rate" would be misleading. Refuse to infer below 24 Hz.
        if (raw >= 24) {
          const candidates = [30, 60, 75, 90, 120, 144, 165, 240];
          const nearest = candidates.reduce(
            (best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best),
            candidates[0]!,
          );
          hz = Math.abs(nearest - raw) <= 6 ? nearest : Math.round(raw);
        }
      }
      const p3 = window.matchMedia("(color-gamut: p3)").matches;
      const hdr = window.matchMedia("(dynamic-range: high)").matches;
      resolve({
        cssWidth: screen.width,
        cssHeight: screen.height,
        physicalWidth: Math.round(screen.width * window.devicePixelRatio),
        physicalHeight: Math.round(screen.height * window.devicePixelRatio),
        dpr: window.devicePixelRatio || 1,
        colorDepth: screen.colorDepth,
        refreshHz: hz,
        p3,
        hdr,
        wideGamutHdr: p3 && hdr,
      });
    };
    requestAnimationFrame(tick);
  });
}

export function collectScreen(
  measurement: DisplayMeasurement,
  checks: UserCheck[],
): ModuleResult {
  const readings: Reading[] = [];
  const notes: string[] = [];

  readings.push(
    {
      key: "resolution",
      label: "Resolution",
      value: `${measurement.cssWidth} × ${measurement.cssHeight} CSS px`,
      evidence: "measured",
      source: "screen.width / screen.height",
      detail: `${measurement.physicalWidth} × ${measurement.physicalHeight} physical pixels at ${measurement.dpr.toFixed(2)}× density.`,
      status: "neutral",
    },
    {
      key: "pixel-density",
      label: "Density class",
      value:
        measurement.dpr >= 3
          ? "Very high (≈3×+)"
          : measurement.dpr >= 2
            ? "High (2×+)"
            : measurement.dpr > 1.3
              ? "Medium (1.5×)"
              : "Standard (1×)",
      evidence: "measured",
      source: "window.devicePixelRatio",
      detail: "Retina-class panels report 2× or more. Text sharpness follows this value.",
      status: measurement.dpr >= 2 ? "good" : "neutral",
      numeric: Math.round(measurement.dpr * 100) / 100,
    },
    {
      key: "refresh",
      label: "Refresh rate",
      value: measurement.refreshHz ? `${measurement.refreshHz} Hz` : null,
      evidence: measurement.refreshHz ? "estimated" : "unavailable",
      source: "Frame cadence sampling",
      detail: measurement.refreshHz
        ? "Inferred from animation frame timing, which the browser can cap at its own compositor rate. Treat it as a floor, not the panel's spec."
        : "Frame timing could not be sampled in this tab.",
      status: measurement.refreshHz && measurement.refreshHz >= 90 ? "good" : "neutral",
      numeric: measurement.refreshHz ?? undefined,
    },
    {
      key: "color-depth",
      label: "Colour depth",
      value: `${measurement.colorDepth}-bit`,
      evidence: "measured",
      source: "screen.colorDepth",
      status: measurement.colorDepth >= 24 ? "good" : "warn",
    },
    {
      key: "gamut",
      label: "Colour gamut",
      value: measurement.p3 ? "Display-P3 wide gamut" : "sRGB",
      evidence: "measured",
      source: "matchMedia(color-gamut)",
      detail: "The browser's own query, which reflects the panel and the OS colour pipeline.",
      status: measurement.p3 ? "good" : "neutral",
    },
    {
      key: "hdr",
      label: "HDR capability",
      value: measurement.hdr ? "High dynamic range" : "Standard dynamic range",
      evidence: "measured",
      source: "matchMedia(dynamic-range)",
      status: "neutral",
    },
  );

  for (const check of checks) {
    readings.push({
      key: `check-${check.id}`,
      label: check.label,
      value: check.passed ? "Passed" : "Defect reported",
      evidence: "user",
      source: "Your visual confirmation",
      detail: check.passed
        ? "You confirmed this pattern renders correctly."
        : "You reported a visible issue. Screenshot the pattern for a repair technician.",
      status: check.passed ? "good" : "bad",
    });
  }

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    notes.push(
      `${failed.length} visual check${failed.length > 1 ? "s" : ""} failed. Uniformity and stuck-pixel faults rarely heal on their own; back up the device before booking a screen repair.`,
    );
  }
  if (measurement.refreshHz && measurement.refreshHz >= 90) {
    notes.push(
      "A high refresh rate does not always run at full speed: most phones drop to 60 Hz in low-power mode or when the content is static.",
    );
  }
  notes.push(
    "Browser frame timing cannot verify sub-pixel defects, burn-in, or true peak brightness. The colour patterns let your eyes do that part.",
  );

  const measuredCount = readings.filter((r) => r.evidence === "measured").length;
  const coverage = checks.length > 0 ? 1 : 0.55;
  const score =
    checks.length > 0
      ? Math.round((checks.filter((c) => c.passed).length / checks.length) * 100)
      : null;

  return makeResult("screen", {
    status: checks.length > 0 ? "complete" : "partial",
    score,
    coverage,
    readings,
    summary:
      checks.length > 0
        ? `${checks.length - failed.length}/${checks.length} visual checks passed · ${measurement.cssWidth}×${measurement.cssHeight} @ ${measurement.dpr.toFixed(2)}×${measurement.refreshHz ? ` · ~${measurement.refreshHz} Hz` : ""}.`
        : `Display measured at ${measurement.cssWidth}×${measurement.cssHeight} @ ${measurement.dpr.toFixed(2)}×. Run the guided visual checks to score it.`,
    notes,
    durationMs: 0,
    ...(measuredCount === 0 ? { status: "partial" as const } : {}),
  });
}
