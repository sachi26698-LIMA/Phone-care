import type { ModuleResult, Reading, UserProfile } from "@/lib/types";
import { makeResult, safe } from "@/lib/collect/common";
import { formatBytes } from "@/lib/utils";

interface StorageEstimateLike {
  usage?: number;
  quota?: number;
  usageDetails?: Record<string, number>;
}

function localBytes(): number | null {
  const est = safe(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? "";
      total += new Blob([key, value]).size;
    }
    return total;
  });
  return est ?? null;
}

function storagePressure(freePct: number): "good" | "warn" | "bad" {
  if (freePct >= 15) return "good";
  if (freePct >= 7) return "warn";
  return "bad";
}

export async function collectStorage(profile: UserProfile): Promise<ModuleResult> {
  const started = performance.now();
  const readings: Reading[] = [];
  const notes: string[] = [];

  let estimate: StorageEstimateLike | undefined;
  try {
    estimate = await navigator.storage?.estimate?.();
  } catch {
    estimate = undefined;
  }

  if (estimate?.quota) {
    const usage = estimate.usage ?? 0;
    const usedPct = (usage / estimate.quota) * 100;
    readings.push({
      key: "origin-usage",
      label: "This site's origin usage",
      value: formatBytes(usage),
      evidence: "measured",
      source: "navigator.storage.estimate()",
      detail: `Of a ${formatBytes(estimate.quota)} browser allowance (${usedPct < 0.1 ? "<0.1" : usedPct.toFixed(1)}% used) for IndexedDB, Cache Storage and service workers on this origin.`,
      status: "neutral",
    });
  } else {
    readings.push({
      key: "origin-usage",
      label: "Browser storage quota",
      value: null,
      evidence: "unavailable",
      source: "navigator.storage.estimate()",
      detail: "This browser does not expose a storage estimate, or the page is not on a secure origin.",
    });
  }

  let persisted: boolean | undefined;
  try {
    persisted = await navigator.storage?.persisted?.();
  } catch {
    persisted = undefined;
  }
  readings.push({
    key: "persisted",
    label: "Persistent storage",
    value:
      persisted === undefined
        ? null
        : persisted
          ? "Granted"
          : "Best-effort (can be evicted)",
    evidence: persisted === undefined ? "unavailable" : "measured",
    source: "navigator.storage.persisted()",
    detail:
      persisted === undefined
        ? "Persistence state is not exposed in this browser."
        : persisted
          ? "The browser will keep PhoneCare's data even under storage pressure."
          : "The browser may clear PhoneCare's local data under storage pressure. Re-run scans if results vanish.",
    status: "neutral",
  });

  const lb = localBytes();
  readings.push({
    key: "local",
    label: "PhoneCare local data",
    value: lb == null ? null : formatBytes(lb),
    evidence: lb == null ? "unavailable" : "measured",
    source: "localStorage",
    detail: "Scan results and preferences are stored only on this device. Nothing you enter is sent anywhere.",
    status: "neutral",
  });

  const idb = typeof indexedDB !== "undefined";
  readings.push({
    key: "indexeddb",
    label: "IndexedDB",
    value: idb ? "Available" : "Blocked",
    evidence: "measured",
    source: "Feature detection",
    detail: idb ? "Used for higher-volume test payloads." : "Private modes and hardened browsers can block IndexedDB.",
    status: idb ? "good" : "warn",
  });

  const totalGb = profile.storageTotalGb;
  const freeGb = profile.storageFreeGb;
  let devicePressure: "good" | "warn" | "bad" | null = null;

  if (totalGb && totalGb > 0 && freeGb != null && freeGb >= 0) {
    const freePct = Math.min(100, (freeGb / totalGb) * 100);
    devicePressure = storagePressure(freePct);
    const usedGb = Math.max(0, totalGb - freeGb);
    readings.push(
      {
        key: "device-free",
        label: "Device free space",
        value: `${freeGb.toFixed(freeGb < 10 ? 1 : 0)} GB`,
        evidence: "user",
        source: "You provided",
        detail: `${freePct.toFixed(0)}% of ${totalGb} GB free. Entered by you from your OS settings.`,
        status: devicePressure,
        numeric: freePct,
      },
      {
        key: "device-used",
        label: "Device space used",
        value: `${usedGb.toFixed(usedGb < 10 ? 1 : 0)} GB`,
        evidence: "user",
        source: "You provided",
        detail: "Total minus free, from your entries.",
        status: "neutral",
      },
    );
  } else {
    readings.push({
      key: "device-free",
      label: "Device free space",
      value: null,
      evidence: "unavailable",
      source: "Web platform",
      detail:
        "Browsers deliberately hide how full your phone's disk is. Read it in Settings → Storage and enter it below for a real analysis.",
    });
  }

  if (devicePressure === "bad") {
    notes.push(
      "Under 7% free space, Android and iOS may slow down, fail updates, or struggle to cache photos. Aim for at least 10–15% free.",
    );
  } else if (devicePressure === "warn") {
    notes.push("Free space is getting tight. Clearing cached media and unused apps usually buys headroom quickly.");
  }

  if (!totalGb) {
    notes.push(
      "The Storage API measures this site's quota only. Enter your device totals to model actual disk pressure and get a score.",
    );
  }

  const measured = readings.filter((r) => r.evidence !== "unavailable").length;
  const coverage = measured / readings.length;
  // A score needs device data. Knowing that the browser will let this origin
  // store N bytes says nothing about how full the phone is, so a quota-only run
  // stays unscored rather than reporting a fixed "78".
  const score: number | null = devicePressure
    ? devicePressure === "good"
      ? 92
      : devicePressure === "warn"
        ? 68
        : 38
    : null;

  return makeResult("storage", {
    status: devicePressure ? "complete" : "partial",
    score,
    coverage,
    readings,
    summary: devicePressure
      ? `${freeGb} GB free of ${totalGb} GB — ${devicePressure === "good" ? "healthy headroom" : devicePressure === "warn" ? "free space is tightening" : "storage pressure detected"}.`
      : estimate?.quota
        ? `Browser origin storage measured (${formatBytes(estimate.usage ?? 0)} used). Enter device totals for disk analysis.`
        : "Storage quota is unavailable in this browser. Enter device totals to continue.",
    notes,
    durationMs: Math.round(performance.now() - started),
  });
}
