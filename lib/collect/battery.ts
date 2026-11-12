import type { ModuleResult, Reading, UserProfile } from "@/lib/types";
import { makeResult, safe } from "@/lib/collect/common";

interface BatteryLike {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}

export type BatteryApiAvailability = "supported" | "unsupported";

type BatteryNavigator = Navigator & { getBattery?: () => Promise<BatteryLike> };

export function hasBatteryApi(): boolean {
  // `in` alone is true when a browser exposes the property as undefined;
  // require a callable function so the UI badge and the readings agree.
  const nav = typeof navigator === "undefined" ? undefined : (navigator as BatteryNavigator);
  return typeof nav?.getBattery === "function";
}

export async function readBattery(): Promise<BatteryLike | null> {
  if (!hasBatteryApi()) return null;
  return (
    (await safe(() =>
      (
        navigator as Navigator & { getBattery: () => Promise<BatteryLike> }
      ).getBattery(),
    )) ?? null
  );
}

/** 80% is the widely used end-of-life threshold for lithium-ion phone batteries. */
export function healthBand(healthPct: number): "good" | "warn" | "bad" {
  if (healthPct >= 85) return "good";
  if (healthPct >= 80) return "warn";
  return "bad";
}

export function estimateHealth(
  designMah?: number,
  fullMah?: number,
): { pct: number; wear: number } | null {
  if (!designMah || !fullMah || designMah <= 0 || fullMah <= 0) return null;
  if (fullMah > designMah * 1.15) return null; // implausible input, refuse to compute
  const pct = Math.min(100, (fullMah / designMah) * 100);
  return { pct, wear: Math.max(0, 100 - pct) };
}

export function formatChargingTime(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60 * 60 * 24) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${m} min`;
}

export interface DrainSample {
  t: number;
  level: number;
  charging: boolean;
}

export interface DrainEstimate {
  perHour: number;
  minutes: number;
  charging: boolean;
  startLevel: number;
  endLevel: number;
}

/** Estimates discharge rate only from a real, non-charging observation window. */
export function estimateDrain(samples: DrainSample[]): DrainEstimate | null {
  const discharging = samples.filter((s) => !s.charging);
  if (discharging.length < 2) return null;
  const first = discharging[0]!;
  const last = discharging[discharging.length - 1]!;
  const hours = (last.t - first.t) / 3_600_000;
  if (hours < 0.02) return null; // under ~72 seconds is too noisy
  const delta = first.level - last.level;
  if (delta <= 0) return null;
  const rate = delta * 100;
  return {
    perHour: rate / hours,
    minutes: Math.round(hours * 60),
    charging: false,
    startLevel: Math.round(first.level * 100),
    endLevel: Math.round(last.level * 100),
  };
}

export async function collectBattery(profile: UserProfile): Promise<ModuleResult> {
  const started = performance.now();
  const readings: Reading[] = [];
  const notes: string[] = [];
  const battery = await readBattery();

  if (!battery) {
    readings.push(
      {
        key: "level",
        label: "Charge level",
        value: null,
        evidence: "unavailable",
        source: "Battery Status API",
        detail:
          "This browser does not expose the Battery Status API. Firefox removed it and Safari never shipped it, both over fingerprinting concerns.",
      },
      {
        key: "health",
        label: "Battery health",
        value: null,
        evidence: "unavailable",
        source: "Web platform",
        detail:
          "No web API exposes battery capacity or wear. Android and iOS keep it inside the OS.",
      },
      {
        key: "temperature",
        label: "Battery temperature",
        value: null,
        evidence: "unavailable",
        source: "Web platform",
        detail: "Not exposed to any web page on any browser.",
      },
    );

    const health = estimateHealth(
      profile.batteryDesignCapacityMah,
      profile.batteryFullChargeCapacityMah,
    );

    if (health) {
      readings.unshift({
        key: "health-estimate",
        label: "Estimated health",
        value: `${health.pct.toFixed(0)}%`,
        evidence: "estimated",
        source: "Computed from your entered capacities",
        detail: `Full-charge capacity ÷ design capacity. Estimated wear: ${health.wear.toFixed(0)}%.`,
        status: healthBand(health.pct),
        numeric: health.pct,
      });
    }

    notes.push(
      "Open PhoneCare in Chrome, Edge, Opera or Samsung Internet on Android to read live charge data.",
    );

    return makeResult("battery", {
      status: health ? "partial" : "unavailable",
      score: health ? Math.round(health.pct) : null,
      coverage: health ? 0.34 : 0,
      readings,
      summary: health
        ? `Live battery telemetry is unavailable in this browser. Your entered capacities give an estimated health of ${health.pct.toFixed(0)}%.`
        : "Live battery telemetry is unavailable in this browser. Enter your capacities to get an estimate.",
      notes,
      durationMs: Math.round(performance.now() - started),
    });
  }

  const levelPct = Math.round(battery.level * 100);
  const isDesktopEdgeCase =
    battery.charging && levelPct === 100 && battery.chargingTime === 0 && !("onlevelchange" in battery);

  readings.push({
    key: "level",
    label: "Charge level",
    value: `${levelPct}%`,
    evidence: "measured",
    source: "Battery Status API",
    detail: "Chromium deliberately reduces precision to limit fingerprinting, so treat it as approximate.",
    status: levelPct <= 15 && !battery.charging ? "warn" : "neutral",
    numeric: levelPct,
  });

  readings.push({
    key: "charging",
    label: "Charging state",
    value: battery.charging ? "Charging" : "On battery",
    evidence: "measured",
    source: "Battery Status API",
    status: battery.charging ? "good" : "neutral",
  });

  const toFull = formatChargingTime(battery.chargingTime);
  const toEmpty = formatChargingTime(battery.dischargingTime);

  readings.push({
    key: "time-to-full",
    label: "Time to full",
    value: battery.charging ? (toFull ?? "Not reported") : "—",
    evidence: toFull ? "measured" : "unavailable",
    source: "Battery Status API",
    detail: toFull
      ? "Reported by the browser; phones frequently over-estimate this."
      : battery.charging
        ? "The browser has not produced a stable estimate yet."
        : "Only meaningful while charging.",
    status: "neutral",
  });

  readings.push({
    key: "time-to-empty",
    label: "Time remaining",
    value: !battery.charging ? (toEmpty ?? "Not reported") : "—",
    evidence: toEmpty ? "measured" : "unavailable",
    source: "Battery Status API",
    status: "neutral",
  });

  const health = estimateHealth(
    profile.batteryDesignCapacityMah,
    profile.batteryFullChargeCapacityMah,
  );

  if (health) {
    readings.push({
      key: "health-estimate",
      label: "Estimated health",
      value: `${health.pct.toFixed(0)}%`,
      evidence: "estimated",
      source: "Computed from your entered capacities",
      detail: `Design ${profile.batteryDesignCapacityMah} mAh · full charge ${profile.batteryFullChargeCapacityMah} mAh. Estimated wear: ${health.wear.toFixed(0)}%.`,
      status: healthBand(health.pct),
      numeric: health.pct,
    });
  } else {
    readings.push({
      key: "health",
      label: "Battery health",
      value: null,
      evidence: "unavailable",
      source: "Web platform",
      detail:
        "No browser can read battery capacity. Add your design and full-charge capacities in the calibration panel to get a transparent estimate.",
    });
  }

  if (profile.batteryCycleCount && profile.batteryCycleCount > 0) {
    const cycles = profile.batteryCycleCount;
    readings.push({
      key: "cycles",
      label: "Charge cycles",
      value: `${cycles}`,
      evidence: "user",
      source: "You provided",
      detail: "Phone batteries are typically rated for 500–1000 full cycles before noticeable wear.",
      status: cycles <= 500 ? "good" : cycles <= 900 ? "warn" : "bad",
      numeric: cycles,
    });
  }

  readings.push(
    {
      key: "temperature",
      label: "Battery temperature",
      value: null,
      evidence: "unavailable",
      source: "Web platform",
      detail:
        "No web API exposes battery temperature. Any website claiming a temperature reading in the browser is inferring it, not measuring it.",
    },
    {
      key: "voltage",
      label: "Voltage / current",
      value: null,
      evidence: "unavailable",
      source: "Web platform",
      detail: "Not exposed to web pages on any mobile browser.",
    },
  );

  if (isDesktopEdgeCase) {
    notes.push(
      "A desktop without a battery often reports 100% and \"charging\". That is a browser default, not a real battery.",
    );
  }
  if (!profile.batteryDesignCapacityMah) {
    notes.push(
      "Health is the one battery metric browsers never expose. Add capacities from your OS settings for an estimate you can verify.",
    );
  }

  const score = health ? Math.round(health.pct) : null;
  const coverage = health ? 0.85 : 0.45;

  return makeResult("battery", {
    status: health ? "complete" : "partial",
    score,
    coverage,
    readings,
    summary: health
      ? `${levelPct}% ${battery.charging ? "and charging" : "on battery"} · estimated health ${health.pct.toFixed(0)}% (${healthBand(health.pct) === "good" ? "healthy" : healthBand(health.pct) === "warn" ? "aging" : "worn"}).`
      : `${levelPct}% ${battery.charging ? "and charging" : "on battery"}. Add capacities for a health estimate.`,
    notes,
    durationMs: Math.round(performance.now() - started),
  });
}
