import type { ModuleResult, Reading } from "@/lib/types";
import { makeResult, median } from "@/lib/collect/common";
import { formatBytes } from "@/lib/utils";

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

const DOWNLOAD_STEPS_MB = [1, 3, 6] as const;

function pickDownloadMb(): number {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const downlink = conn?.downlink;
  if (typeof downlink === "number") {
    if (downlink < 1.5) return DOWNLOAD_STEPS_MB[0];
    if (downlink < 8) return DOWNLOAD_STEPS_MB[1];
    return DOWNLOAD_STEPS_MB[2];
  }
  return DOWNLOAD_STEPS_MB[1];
}

export interface NetworkProgress {
  phase: "latency" | "download" | "upload" | "done";
  progress: number;
  message: string;
}

async function measureLatency(
  samples: number,
  onProgress?: (p: NetworkProgress) => void,
): Promise<{ medianMs: number; minMs: number; jitterMs: number } | null> {
  const timings: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const start = performance.now();
      const res = await fetch(`/api/network/ping?i=${i}&t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      await res.text();
      timings.push(performance.now() - start);
    } catch {
      // A single failed probe should not abort the whole test.
    } finally {
      clearTimeout(timer);
    }
    onProgress?.({
      phase: "latency",
      progress: ((i + 1) / samples) * 100,
      message: `Round-trip probe ${i + 1} of ${samples}`,
    });
  }
  if (timings.length === 0) return null;
  const usable = timings.length > 2 ? timings.slice(1) : timings; // discard cold-connection sample
  const jitter = median(usable.map((t, i) => Math.abs(t - (usable[i - 1] ?? t))).slice(1));
  return { medianMs: median(usable), minMs: Math.min(...usable), jitterMs: jitter };
}

async function measureDownload(
  bytes: number,
  onProgress?: (p: NetworkProgress) => void,
): Promise<{ mbps: number; ms: number; transferred: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const start = performance.now();
    const res = await fetch(`/api/network/download?bytes=${bytes}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      onProgress?.({
        phase: "download",
        progress: Math.min(99, (received / bytes) * 100),
        message: `Downloading test payload · ${formatBytes(received)}`,
      });
    }
    const ms = performance.now() - start;
    // Very fast links can finish a small payload before the timer is meaningful.
    if (ms < 8 || received < 1024) return null;
    return { mbps: (received * 8) / (ms / 1000) / 1_000_000, ms, transferred: received };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function measureUpload(
  bytes: number,
  onProgress?: (p: NetworkProgress) => void,
): Promise<{ mbps: number; ms: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const payload = new Uint8Array(bytes);
    // Fill with pseudo-random data so compression cannot inflate the result.
    for (let i = 0; i < bytes; i += 4096) payload[i] = (i / 4096) % 251;
    onProgress?.({ phase: "upload", progress: 15, message: "Uploading test payload" });
    const start = performance.now();
    const res = await fetch(`/api/network/upload?t=${Date.now()}`, {
      method: "POST",
      body: payload,
      cache: "no-store",
      headers: { "Content-Type": "application/octet-stream" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    await res.text();
    const ms = performance.now() - start;
    if (ms < 8) return null;
    onProgress?.({ phase: "upload", progress: 100, message: "Upload complete" });
    return { mbps: (bytes * 8) / (ms / 1000) / 1_000_000, ms };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function downloadScore(mbps: number) {
  if (mbps >= 50) return 95;
  if (mbps >= 20) return 85;
  if (mbps >= 8) return 70;
  if (mbps >= 2) return 55;
  return 35;
}
function uploadScore(mbps: number) {
  if (mbps >= 20) return 92;
  if (mbps >= 8) return 80;
  if (mbps >= 3) return 66;
  if (mbps >= 1) return 52;
  return 38;
}
function latencyScore(ms: number) {
  if (ms <= 40) return 94;
  if (ms <= 80) return 84;
  if (ms <= 150) return 70;
  if (ms <= 300) return 52;
  return 34;
}

export async function collectNetwork(
  onProgress?: (p: NetworkProgress) => void,
): Promise<ModuleResult> {
  const started = performance.now();
  const readings: Reading[] = [];
  const notes: string[] = [];
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;

  if (conn) {
    readings.push({
      key: "effective-type",
      label: "Connection class",
      value: conn.effectiveType ? conn.effectiveType.toUpperCase() : null,
      evidence: conn.effectiveType ? "estimated" : "unavailable",
      source: "Network Information API",
      detail:
        "A coarse, browser-computed bucket derived from recent traffic — not a radio measurement of your signal strength.",
      status:
        conn.effectiveType === "4g"
          ? "good"
          : conn.effectiveType === "3g"
            ? "warn"
            : conn.effectiveType
              ? "bad"
              : "neutral",
    });
    if (typeof conn.downlink === "number") {
      readings.push({
        key: "downlink-hint",
        label: "Browser downlink hint",
        value: `${conn.downlink.toFixed(1)} Mbps`,
        evidence: "estimated",
        source: "Network Information API",
        detail: "A rounded hint capped at 10 Mbps. The measured figure below is the more reliable one.",
        status: "neutral",
      });
    }
    if (typeof conn.rtt === "number") {
      readings.push({
        key: "rtt-hint",
        label: "Browser RTT hint",
        value: `${conn.rtt} ms`,
        evidence: "estimated",
        source: "Network Information API",
        status: "neutral",
      });
    }
    if (conn.saveData) {
      notes.push("Data Saver is enabled, which can cap background throughput and throttle media.");
    }
  } else {
    readings.push({
      key: "effective-type",
      label: "Connection class",
      value: null,
      evidence: "unavailable",
      source: "Network Information API",
      detail: "Only Chromium-based browsers expose connection hints. A speed test still works here.",
    });
  }

  const latency = await measureLatency(6, onProgress);
  if (latency) {
    readings.push({
      key: "latency",
      label: "Round-trip latency",
      value: `${Math.round(latency.medianMs)} ms`,
      evidence: "measured",
      source: "Six same-origin HTTPS probes",
      detail: `Median of ${6} probes · best ${Math.round(latency.minMs)} ms · jitter ${Math.round(latency.jitterMs)} ms. Includes network plus server response time.`,
      status: latencyScore(latency.medianMs) >= 84 ? "good" : latencyScore(latency.medianMs) >= 60 ? "warn" : "bad",
      numeric: Math.round(latency.medianMs),
    });
    if (latency.jitterMs > 60) {
      notes.push(
        `Jitter of ${Math.round(latency.jitterMs)} ms is high. Voice and video calls are the first thing to suffer.`,
      );
    }
  } else {
    readings.push({
      key: "latency",
      label: "Round-trip latency",
      value: null,
      evidence: "unavailable",
      source: "HTTPS probes",
      detail: "Probes failed. The site may be offline, or a firewall is blocking requests.",
    });
  }

  let downloadMb = pickDownloadMb();
  onProgress?.({ phase: "download", progress: 0, message: `Preparing ${downloadMb} MB download test` });
  let download = await measureDownload(downloadMb * 1024 * 1024, onProgress);
  // If the transfer was too brief to time reliably, repeat with the largest payload.
  if (download && download.ms < 120 && downloadMb < 8) {
    downloadMb = 8;
    onProgress?.({ phase: "download", progress: 0, message: "Link is fast — repeating with 8 MB" });
    download = (await measureDownload(downloadMb * 1024 * 1024, onProgress)) ?? download;
  }
  if (download) {
    readings.push({
      key: "download",
      label: "Download speed",
      value: `${download.mbps.toFixed(1)} Mbps`,
      evidence: "measured",
      source: "Same-origin payload transfer",
      detail: `${formatBytes(download.transferred)} transferred in ${(download.ms / 1000).toFixed(2)} s. Measured against PhoneCare's own endpoint, so distance to the host is included.`,
      status: downloadScore(download.mbps) >= 85 ? "good" : downloadScore(download.mbps) >= 60 ? "warn" : "bad",
      numeric: Math.round(download.mbps * 10) / 10,
    });
  } else {
    readings.push({
      key: "download",
      label: "Download speed",
      value: null,
      evidence: "unavailable",
      source: "Same-origin payload transfer",
      detail: "The transfer could not be completed. Check your connection or try a smaller test.",
    });
  }

  onProgress?.({ phase: "upload", progress: 0, message: "Preparing upload test" });
  let upload = await measureUpload(2_000_000, onProgress);
  if (upload && upload.ms < 60) {
    const retry = await measureUpload(4_000_000, onProgress);
    upload = retry ?? upload;
  }
  if (upload) {
    readings.push({
      key: "upload",
      label: "Upload speed",
      value: `${upload.mbps.toFixed(1)} Mbps`,
      evidence: "measured",
      source: "Same-origin payload transfer",
      detail: `2–4 MB uploaded in ${(upload.ms / 1000).toFixed(2)} s.`,
      status: uploadScore(upload.mbps) >= 80 ? "good" : uploadScore(upload.mbps) >= 60 ? "warn" : "bad",
      numeric: Math.round(upload.mbps * 10) / 10,
    });
  } else {
    readings.push({
      key: "upload",
      label: "Upload speed",
      value: null,
      evidence: "unavailable",
      source: "Same-origin payload transfer",
      detail: "The upload could not be completed.",
    });
  }

  readings.push({
    key: "public-ip",
    label: "Public IP / ISP",
    value: null,
    evidence: "unavailable",
    source: "Not tested",
    detail:
      "PhoneCare does not contact third-party IP or speed services. That keeps the scan private and free of external dependencies.",
  });

  const scores: number[] = [];
  if (download) scores.push(downloadScore(download.mbps) * 0.5);
  if (upload) scores.push(uploadScore(upload.mbps) * 0.3);
  if (latency) scores.push(latencyScore(latency.medianMs) * 0.2);
  const weightSum =
    (download ? 0.5 : 0) + (upload ? 0.3 : 0) + (latency ? 0.2 : 0);
  const score = weightSum > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / weightSum) : null;

  const measured = readings.filter((r) => r.evidence === "measured").length;
  const coverage = Math.min(1, (measured / 4) * 0.85 + (conn ? 0.15 : 0));

  const summaryParts: string[] = [];
  if (download) summaryParts.push(`${download.mbps.toFixed(1)} Mbps down`);
  if (upload) summaryParts.push(`${upload.mbps.toFixed(1)} Mbps up`);
  if (latency) summaryParts.push(`${Math.round(latency.medianMs)} ms latency`);

  notes.push(
    "Speed depends on how far you are from the server answering this test. Use the numbers to compare across sessions, not against a carrier's marketing claim.",
  );

  onProgress?.({ phase: "done", progress: 100, message: "Network test complete" });

  return makeResult("network", {
    status: score != null ? "complete" : "error",
    score,
    coverage,
    readings,
    summary: summaryParts.length
      ? summaryParts.join(" · ") + (conn?.effectiveType ? ` over a ${conn.effectiveType.toUpperCase()} link.` : ".")
      : "Network measurements could not be completed.",
    notes,
    durationMs: Math.round(performance.now() - started),
  });
}
