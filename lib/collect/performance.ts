import type { ModuleResult, Reading } from "@/lib/types";
import { makeResult, safe } from "@/lib/collect/common";
import { clamp } from "@/lib/utils";

export interface FrameSample {
  fps: number;
  frames: number;
  longFrames: number;
  durationMs: number;
  medianDelta: number;
}

/** Counts real animation frames for `durationMs` and returns cadence metrics. */
export function sampleFrames(durationMs = 1000): Promise<FrameSample> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const start = last;

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - start;
      const sorted = [...deltas].sort((a, b) => a - b);
      const medianDelta = sorted[Math.floor(sorted.length / 2)] ?? 16.7;
      const longFrames = deltas.filter((d) => d > medianDelta * 2.2).length;
      resolve({
        fps: (deltas.length / elapsed) * 1000,
        frames: deltas.length,
        longFrames,
        durationMs: elapsed,
        medianDelta,
      });
    };
    requestAnimationFrame(tick);
  });
}

/** Deterministic integer benchmark; returns millions of operations per second. */
export function runComputeBenchmark(iterations = 6_000_000): number {
  let x = 123456789;
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 1274126177) >>> 0;
  }
  const ms = performance.now() - start;
  // Keep the result observable so the engine cannot optimise the loop away.
  if (x === 42) return 0;
  return iterations / 1_000_000 / (ms / 1000);
}

export function computeScore(mops: number) {
  if (mops >= 400) return 96;
  if (mops >= 250) return 88;
  if (mops >= 150) return 78;
  if (mops >= 80) return 66;
  if (mops >= 40) return 54;
  return 40;
}

export interface StorageSpeed {
  writeMbPerSec: number;
  readMbPerSec: number;
  bytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("phonecare-bench", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("payload")) db.createObjectStore("payload");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function measureStorageSpeed(bytes = 1_000_000): Promise<StorageSpeed | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb().catch(() => null);
  if (!db) return null;
  try {
    const payload = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 512) payload[i] = i % 255;

    const writeStart = performance.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("payload", "readwrite");
      tx.objectStore("payload").put(payload, "bench");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const writeMs = performance.now() - writeStart;

    const readStart = performance.now();
    const read = await new Promise<Uint8Array | undefined>((resolve, reject) => {
      const tx = db.transaction("payload", "readonly");
      const req = tx.objectStore("payload").get("bench");
      req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
      tx.onerror = () => reject(tx.error);
    });
    const readMs = performance.now() - readStart;

    await new Promise<void>((resolve) => {
      const tx = db.transaction("payload", "readwrite");
      tx.objectStore("payload").delete("bench");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    if (!read || writeMs <= 0 || readMs <= 0) return null;
    return {
      writeMbPerSec: bytes / 1_000_000 / (writeMs / 1000),
      readMbPerSec: bytes / 1_000_000 / (readMs / 1000),
      bytes,
    };
  } catch {
    // Private modes can expose IndexedDB yet refuse the write. That is a
    // missing reading, not a failed module.
    return null;
  } finally {
    db.close();
  }
}

function storageScore(mbps: number) {
  if (mbps >= 120) return 92;
  if (mbps >= 50) return 82;
  if (mbps >= 15) return 68;
  if (mbps >= 5) return 55;
  return 42;
}

function frameScore(fps: number, longFrames: number, frames: number) {
  const ratio = frames > 0 ? longFrames / frames : 0;
  let base: number;
  if (fps >= 110) base = 96;
  else if (fps >= 55) base = 90;
  else if (fps >= 45) base = 76;
  else if (fps >= 30) base = 62;
  else base = 44;
  return clamp(Math.round(base - ratio * 60), 20, 98);
}

export async function collectPerformance(): Promise<ModuleResult> {
  const started = performance.now();
  const readings: Reading[] = [];
  const notes: string[] = [];

  const cores = navigator.hardwareConcurrency;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const heap = safe(
    () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } })
        .memory,
  );

  // Warm up, then measure twice and keep the best to reduce JIT noise.
  runComputeBenchmark(600_000);
  const mops = Math.max(runComputeBenchmark(), runComputeBenchmark());
  const cScore = computeScore(mops);

  const frames = await sampleFrames(1200);
  // Below 20 fps the sample is almost always a throttled/background tab rather
  // than a slow display; scoring it would defame healthy hardware.
  const fpsUsable = frames.fps >= 20;
  const fScore = fpsUsable ? frameScore(frames.fps, frames.longFrames, frames.frames) : null;
  const storage = await measureStorageSpeed();
  const sScore = storage ? storageScore(storage.writeMbPerSec) : null;

  readings.push(
    {
      key: "cores",
      label: "Logical CPU threads",
      value: cores ? String(cores) : null,
      evidence: cores ? "measured" : "unavailable",
      source: "navigator.hardwareConcurrency",
      detail: "Threads exposed to the browser. Some browsers cap this value for privacy.",
      status: cores && cores >= 6 ? "good" : cores && cores >= 4 ? "neutral" : "warn",
      numeric: cores,
    },
    {
      key: "memory-class",
      label: "Memory class",
      value: mem ? `${mem} GB` : null,
      evidence: mem ? "measured" : "unavailable",
      source: "navigator.deviceMemory",
      detail: "A rounded bucket, capped at 8 GB in Chromium and hidden in Safari/Firefox.",
      status: mem && mem >= 4 ? "good" : mem ? "warn" : "neutral",
      numeric: mem,
    },
    {
      key: "compute",
      label: "JS compute index",
      value: `${mops.toFixed(0)} Mops/s`,
      evidence: "measured",
      source: "Deterministic integer loop",
      detail:
        "A throughput index for this browser session, not a comparison against other devices. Engine differences and background load shift it.",
      status: cScore >= 85 ? "good" : cScore >= 60 ? "neutral" : "warn",
      numeric: Math.round(mops),
    },
    {
      key: "fps",
      label: "Frame cadence",
      value: fpsUsable ? `${frames.fps.toFixed(0)} fps` : null,
      evidence: fpsUsable ? "measured" : "unavailable",
      source: "requestAnimationFrame over 1.2 s",
      detail: fpsUsable
        ? `${frames.frames} frames · ${frames.longFrames} long frames · median ${frames.medianDelta.toFixed(1)} ms. Capped by your display's refresh rate.`
        : `Only ${frames.fps.toFixed(0)} fps were sampled. A hidden or throttled tab produces the same result, so this is not treated as a display limit. Re-run with the tab visible.`,
      status: fpsUsable ? (fScore! >= 85 ? "good" : fScore! >= 60 ? "warn" : "bad") : "neutral",
      numeric: fpsUsable ? Math.round(frames.fps) : undefined,
    },
    {
      key: "storage-speed",
      label: "IndexedDB write speed",
      value: storage ? `${storage.writeMbPerSec.toFixed(0)} MB/s` : null,
      evidence: storage ? "measured" : "unavailable",
      source: "1 MB IndexedDB round-trip",
      detail: storage
        ? `1 MB write in ${(1000 / storage.writeMbPerSec).toFixed(0)} ms · read ${storage.readMbPerSec.toFixed(0)} MB/s. Browser storage is slower than native NAND and is not a disk health test.`
        : "IndexedDB is unavailable in this browser or private mode.",
      status: storage ? (sScore && sScore >= 80 ? "good" : sScore && sScore >= 60 ? "neutral" : "warn") : "neutral",
      numeric: storage ? Math.round(storage.writeMbPerSec) : undefined,
    },
    {
      key: "heap",
      label: "JS heap in use",
      value: heap ? `${(heap.usedJSHeapSize / 1_048_576).toFixed(1)} MB` : null,
      evidence: heap ? "measured" : "unavailable",
      source: "performance.memory (non-standard)",
      detail: heap
        ? `Limit ${(heap.jsHeapSizeLimit / 1_048_576).toFixed(0)} MB. Chromium-only, non-standard, and browser-internal.`
        : "This browser does not expose performance.memory. That is expected outside Chromium.",
      status: "neutral",
      numeric: heap ? Math.round(heap.usedJSHeapSize / 1_048_576) : undefined,
    },
  );

  // Only measured signals carry weight. Filling a missing storage sample with a
  // neutral 70 would quietly pull every unmeasured device toward that number.
  const parts: Array<[number, number]> = [[cScore, 0.5]];
  if (fpsUsable && fScore != null) parts.push([fScore, 0.35]);
  if (sScore != null) parts.push([sScore, 0.15]);
  const weightTotal = parts.reduce((sum, [, weight]) => sum + weight, 0);
  let score = Math.round(parts.reduce((sum, [value, weight]) => sum + value * weight, 0) / weightTotal);
  // Raw throughput can look impressive on a device with very few threads; cap
  // the index so a 2-thread phone is not labelled "excellent" for its class.
  if (cores != null) {
    if (cores <= 2) score = Math.min(score, 74);
    else if (cores <= 4) score = Math.min(score, 86);
  }

  if (fpsUsable && frames.fps < 55 && frames.medianDelta <= 17) {
    notes.push("Frame cadence looks reduced even though display timing is normal — background tabs or power saving may be throttling rendering.");
  }
  if (cores && cores <= 4) {
    notes.push("Four or fewer logical threads is typical of entry-level hardware; expect heavier apps and games to feel slower.");
  }
  if (!storage) {
    notes.push("Storage speed could not be measured because IndexedDB is blocked. Private browsing modes often cause this.");
  }
  if (!fpsUsable) {
    notes.push(
      "Frame sampling was very low. That usually means the tab was backgrounded or the device was under heavy load at the time, not that the display is limited to this rate. Re-run with the tab in the foreground.",
    );
  }

  return makeResult("performance", {
    status: "complete",
    score,
    coverage: (fpsUsable ? 1 : 0.88) * (storage ? 1 : 0.88),
    readings,
    summary: `${fpsUsable ? `${frames.fps.toFixed(0)} fps cadence · ` : ""}${mops.toFixed(0)} Mops/s compute · ${cores ?? "unknown"} threads${storage ? ` · ${storage.writeMbPerSec.toFixed(0)} MB/s browser storage` : ""}.`,
    notes,
    durationMs: Math.round(performance.now() - started),
  });
}
