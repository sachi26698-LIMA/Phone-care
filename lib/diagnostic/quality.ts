/**
 * Internet quality engine (browser side).
 *
 * Implements docs/native/NETWORK-SPEC.md §1-§3: repeated probes with median,
 * minimum, jitter and failure rate; DNS/TTFB from Resource Timing; directional
 * throughput with validity gates; and a score that is withheld — not guessed —
 * when the link is too unstable for the measurement to mean anything.
 *
 * It deliberately does not reuse `lib/collect/network.ts`. That module feeds
 * the Phase 2 diagnostic card and its behaviour is verified; this engine is the
 * measurement lab and reports richer per-probe evidence.
 */

export type ProbeFailure = "none" | "timeout" | "network" | "http";

export interface ProbeSample {
  index: number;
  /** Null on failure. Never interpolated from neighbouring samples. */
  rttMs: number | null;
  failure: ProbeFailure;
  dnsMs: number | null;
  ttfbMs: number | null;
  at: string;
}

export interface LatencySummary {
  attempted: number;
  succeeded: number;
  failures: number;
  failureRatePct: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  jitterMs: number | null;
  /** Coefficient of variation of the successful RTTs, in percent. */
  cvPct: number | null;
  /** Half the interquartile range: the uncertainty we publish next to the median. */
  spreadMs: number | null;
}

export interface TransferResult {
  direction: "download" | "upload";
  bytes: number;
  ms: number;
  mbps: number;
  endpoint: string;
  startedAt: string;
}

export interface StabilityResult {
  roundMedians: number[];
  cvPct: number | null;
  /** Absolute spread between round medians, in ms. A large CV on a tiny absolute
   *  spread is not instability — e.g. 4 ms vs 12 ms is noise, not a bad link. */
  rangeMs: number | null;
  label: "stable" | "variable" | "unstable" | "unknown";
}

export interface QualityScore {
  download: number | null;
  upload: number | null;
  latency: number | null;
  stability: number | null;
  total: number | null;
}

export interface ValidityAssessment {
  scored: boolean;
  reasons: string[];
}

export interface ProbeRun {
  samples: ProbeSample[];
  summary: LatencySummary;
  startedAt: string;
  durationMs: number;
}

export interface QualityRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  server: { origin: string; endpoint: string; label: string };
  transport: "wifi" | "cellular" | "ethernet" | "unknown";
  samples: ProbeSample[];
  latency: LatencySummary;
  stability: StabilityResult;
  download: TransferResult | null;
  upload: TransferResult | null;
  dnsMs: number | null;
  ttfbMs: number | null;
  validity: ValidityAssessment;
  scores: QualityScore;
  limitations: string[];
}

export const PROBE_ENDPOINT = "/api/network/ping";
export const DOWNLOAD_ENDPOINT = "/api/network/download";
export const UPLOAD_ENDPOINT = "/api/network/upload";

const PROBE_TIMEOUT_MS = 4_000;
const TRANSFER_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MIN_MEANINGFUL_TRANSFER_MS = 8;

function nowIso() {
  return new Date().toISOString();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index] ?? null;
}

export function summariseProbes(samples: ProbeSample[]): LatencySummary {
  const attempted = samples.length;
  const successful = samples.filter((s): s is ProbeSample & { rttMs: number } => s.rttMs !== null);
  const failures = attempted - successful.length;
  const rtts = successful.map((s) => s.rttMs);
  // Latency needs a cold-start sample removed: the first probe pays DNS + TLS.
  const usable = rtts.length > 3 ? rtts.slice(1) : rtts;
  const base = usable.length > 0 ? usable : rtts;
  const differences = base.slice(1).map((value, index) => Math.abs(value - (base[index] ?? value)));
  const mean = base.length > 0 ? base.reduce((sum, v) => sum + v, 0) / base.length : null;
  const variance =
    mean !== null && base.length > 1
      ? base.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (base.length - 1)
      : null;
  const p25 = percentile(base, 25);
  const p75 = percentile(base, 75);

  return {
    attempted,
    succeeded: successful.length,
    failures,
    failureRatePct: attempted > 0 ? (failures / attempted) * 100 : 0,
    medianMs: median(base),
    minMs: base.length > 0 ? Math.min(...base) : null,
    maxMs: base.length > 0 ? Math.max(...base) : null,
    jitterMs: differences.length > 0 ? differences.reduce((a, b) => a + b, 0) / differences.length : null,
    cvPct: mean !== null && mean > 0 && variance !== null ? (Math.sqrt(variance) / mean) * 100 : null,
    spreadMs: p25 !== null && p75 !== null ? (p75 - p25) / 2 : null,
  };
}

/** Reads DNS/TTFB for the most recent probe from Resource Timing, if exposed. */
function readResourceTiming(url: string): { dnsMs: number | null; ttfbMs: number | null } {
  if (typeof performance === "undefined" || typeof performance.getEntriesByName !== "function") {
    return { dnsMs: null, ttfbMs: null };
  }
  const entry = performance.getEntriesByName(url, "resource").at(-1) as PerformanceResourceTiming | undefined;
  if (!entry) return { dnsMs: null, ttfbMs: null };
  // Chromium reports 0 for cached or opaque lookups; 0 is not a measurement.
  const dnsMs =
    entry.domainLookupEnd > 0 && entry.domainLookupStart > 0 && entry.domainLookupEnd >= entry.domainLookupStart
      ? entry.domainLookupEnd - entry.domainLookupStart
      : null;
  const ttfbMs =
    entry.responseStart > 0 && entry.requestStart > 0 && entry.responseStart >= entry.requestStart
      ? entry.responseStart - entry.requestStart
      : null;
  return { dnsMs, ttfbMs };
}

export async function runProbeSeries(
  options: { count?: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<ProbeRun> {
  const count = options.count ?? 8;
  const samples: ProbeSample[] = [];
  const startedAt = nowIso();
  const started = performance.now();

  for (let index = 0; index < count; index += 1) {
    if (options.signal?.aborted) break;
    const url = `${PROBE_ENDPOINT}?probe=${index}&t=${Date.now()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startedProbe = performance.now();
    let failure: ProbeFailure = "none";
    let rttMs: number | null = null;
    let status: number | null = null;
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      status = response.status;
      await response.text();
      rttMs = performance.now() - startedProbe;
    } catch (error) {
      failure = controller.signal.aborted ? "timeout" : "network";
      void error;
    } finally {
      clearTimeout(timer);
    }
    if (rttMs !== null && status !== null && (status < 200 || status >= 300)) {
      failure = "http";
      rttMs = null;
    }
    const timing = rttMs !== null ? readResourceTiming(url) : { dnsMs: null, ttfbMs: null };
    samples.push({
      index,
      rttMs: rttMs !== null ? Math.round(rttMs * 10) / 10 : null,
      failure,
      dnsMs: timing.dnsMs !== null ? Math.round(timing.dnsMs * 10) / 10 : null,
      ttfbMs: timing.ttfbMs !== null ? Math.round(timing.ttfbMs * 10) / 10 : null,
      at: nowIso(),
    });
    options.onProgress?.(index + 1, count);
  }

  return {
    samples,
    summary: summariseProbes(samples),
    startedAt,
    durationMs: Math.round(performance.now() - started),
  };
}

function randomPayload(bytes: number): Uint8Array {
  const payload = new Uint8Array(bytes);
  const block = 65_536;
  const scratch = new Uint8Array(block);
  for (let offset = 0; offset < bytes; offset += block) {
    crypto.getRandomValues(scratch);
    payload.set(offset + block <= bytes ? scratch : scratch.subarray(0, bytes - offset), offset);
  }
  return payload;
}

export async function runDownload(
  bytes: number,
  onProgress?: (received: number, total: number) => void,
): Promise<TransferResult | null> {
  const size = Math.min(Math.max(bytes, 64 * 1024), MAX_DOWNLOAD_BYTES);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  const startedAt = nowIso();
  const start = performance.now();
  try {
    const endpoint = `${DOWNLOAD_ENDPOINT}?bytes=${size}&t=${Date.now()}`;
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      onProgress?.(received, size);
    }
    const ms = performance.now() - start;
    if (received < 1024 || ms < MIN_MEANINGFUL_TRANSFER_MS) return null;
    return {
      direction: "download",
      bytes: received,
      ms: Math.round(ms),
      mbps: (received * 8) / (ms / 1000) / 1_000_000,
      endpoint,
      startedAt,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function runUpload(
  bytes: number,
  onProgress?: (sent: number, total: number) => void,
): Promise<TransferResult | null> {
  const size = Math.min(Math.max(bytes, 64 * 1024), MAX_UPLOAD_BYTES);
  const payload = randomPayload(size);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  const startedAt = nowIso();
  const start = performance.now();
  onProgress?.(0, size);
  try {
    const endpoint = `${UPLOAD_ENDPOINT}?t=${Date.now()}`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: payload as unknown as BodyInit,
      cache: "no-store",
      headers: { "Content-Type": "application/octet-stream" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    await response.text();
    const ms = performance.now() - start;
    if (ms < MIN_MEANINGFUL_TRANSFER_MS) return null;
    onProgress?.(size, size);
    return {
      direction: "upload",
      bytes: size,
      ms: Math.round(ms),
      mbps: (size * 8) / (ms / 1000) / 1_000_000,
      endpoint,
      startedAt,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function scoreQuality(
  latency: LatencySummary,
  downloadMbps: number | null,
  uploadMbps: number | null,
  stability: StabilityResult | null,
): QualityScore {
  const download =
    downloadMbps === null
      ? null
      : downloadMbps >= 50
        ? 95
        : downloadMbps >= 20
          ? 85
          : downloadMbps >= 8
            ? 70
            : downloadMbps >= 2
              ? 55
              : 35;
  const upload =
    uploadMbps === null
      ? null
      : uploadMbps >= 20
        ? 92
        : uploadMbps >= 8
          ? 80
          : uploadMbps >= 3
            ? 66
            : uploadMbps >= 1
              ? 52
              : 38;
  const ms = latency.medianMs;
  const latencyScore =
    ms === null ? null : ms <= 40 ? 94 : ms <= 80 ? 84 : ms <= 150 ? 70 : ms <= 300 ? 52 : 34;
  const stabilityCv = stability?.cvPct ?? null;
  const stabilityRange = stability?.rangeMs ?? null;
  // Same absolute floor as the label: ≤20 ms of drift is stable regardless of CV.
  const effectiveCv = stabilityCv === null ? null : stabilityRange !== null && stabilityRange <= 20 ? Math.min(stabilityCv, 10) : stabilityCv;
  const stabilityScore =
    effectiveCv === null
      ? null
      : effectiveCv <= 10
        ? 92
        : effectiveCv <= 25
          ? 74
          : effectiveCv <= 50
            ? 52
            : 30;

  const parts: Array<[number | null, number]> = [
    [download, 0.45],
    [upload, 0.25],
    [latencyScore, 0.2],
    [stabilityScore, 0.1],
  ];
  const usable = parts.filter(([value]) => value !== null);
  const weight = usable.reduce((sum, [, w]) => sum + w, 0);
  const total =
    weight > 0 ? Math.round(usable.reduce((sum, [value, w]) => sum + (value as number) * w, 0) / weight) : null;

  return { download, upload, latency: latencyScore, stability: stabilityScore, total };
}

export function assessValidity(
  latency: LatencySummary,
  download: TransferResult | null,
  upload: TransferResult | null,
): ValidityAssessment {
  const reasons: string[] = [];
  if (latency.attempted < 3) reasons.push("fewer than three probes attempted");
  else if (latency.succeeded < 3) reasons.push("fewer than three successful probes");
  if (latency.jitterMs !== null && latency.jitterMs > 150) {
    reasons.push(`jitter ${Math.round(latency.jitterMs)} ms exceeds the 150 ms RFC 6349 ceiling`);
  }
  if (latency.failureRatePct > 5) {
    reasons.push(`probe failure rate ${latency.failureRatePct.toFixed(1)} % exceeds 5 %`);
  }
  if (!download && !upload) reasons.push("no throughput transfer completed");
  return { scored: reasons.length === 0, reasons };
}

export function buildStability(roundMedians: Array<number | null>): StabilityResult {
  const values = roundMedians.filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length < 2) {
    return { roundMedians: values, cvPct: null, rangeMs: null, label: "unknown" };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  const cv = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : null;
  const range = Math.max(...values) - Math.min(...values);
  // Absolute floor: below 20 ms of round-to-round drift, the link is stable for
  // anything a user can notice, even if the relative variation looks large.
  const label: StabilityResult["label"] =
    cv === null ? "unknown" : cv <= 10 || range <= 20 ? "stable" : cv <= 25 ? "variable" : "unstable";
  return { roundMedians: values, cvPct: cv, rangeMs: range, label };
}

function detectTransport(): QualityRun["transport"] {
  const connection = (navigator as Navigator & { connection?: { type?: string } }).connection;
  const type = connection?.type;
  if (type === "wifi") return "wifi";
  if (type === "cellular") return "cellular";
  if (type === "ethernet") return "ethernet";
  return "unknown";
}

export interface QualityProgress {
  phase: "latency" | "transfer" | "stability" | "done";
  progress: number;
  message: string;
}

export async function runQualityTest(
  onProgress?: (progress: QualityProgress) => void,
): Promise<QualityRun> {
  const startedAt = nowIso();
  const started = performance.now();
  const origin = typeof location !== "undefined" ? location.origin : "";
  const server = {
    origin,
    endpoint: PROBE_ENDPOINT,
    label: `Same-origin PhoneCare endpoint (${origin || "unknown origin"}) · physical server location is not exposed by the deployment`,
  };

  onProgress?.({ phase: "latency", progress: 0, message: "Running the first probe round" });
  const first = await runProbeSeries({
    count: 8,
    onProgress: (done, total) =>
      onProgress?.({
        phase: "latency",
        progress: (done / total) * 40,
        message: `Probe ${done} of ${total}`,
      }),
  });

  onProgress?.({ phase: "transfer", progress: 45, message: "Measuring download throughput" });
  const download = await runDownload(3 * 1024 * 1024, (received, total) =>
    onProgress?.({
      phase: "transfer",
      progress: 45 + (received / total) * 15,
      message: `Downloading · ${(received / (1024 * 1024)).toFixed(1)} of ${(total / (1024 * 1024)).toFixed(0)} MB`,
    }),
  );

  onProgress?.({ phase: "transfer", progress: 62, message: "Measuring upload throughput" });
  const upload = await runUpload(2_000_000);

  onProgress?.({ phase: "stability", progress: 78, message: "Repeating probes to check stability" });
  const second = await runProbeSeries({ count: 5 });
  const third = await runProbeSeries({ count: 5 });

  const samples = [...first.samples, ...second.samples, ...third.samples];
  const latency = summariseProbes(samples);
  const stability = buildStability([first.summary.medianMs, second.summary.medianMs, third.summary.medianMs]);
  const validity = assessValidity(latency, download, upload);
  const scores = scoreQuality(latency, download?.mbps ?? null, upload?.mbps ?? null, stability);
  const lastSuccess = [...samples].reverse().find((s) => s.rttMs !== null);
  const dnsMs = lastSuccess?.dnsMs ?? null;
  const ttfbMs = lastSuccess?.ttfbMs ?? null;

  return {
    startedAt,
    finishedAt: nowIso(),
    durationMs: Math.round(performance.now() - started),
    server,
    transport: detectTransport(),
    samples,
    latency,
    stability,
    download,
    upload,
    dnsMs,
    ttfbMs,
    validity,
    scores: validity.scored ? scores : { ...scores, total: null },
    limitations: [
      "Throughput is measured against this deployment, so the distance to the server is part of the result.",
      "Probe failures are HTTP-level failures, not packet loss; the browser cannot see dropped packets.",
      "Radio signal strength (RSRP, SINR, Wi-Fi RSSI) is unavailable to browsers; use the Android app for those readings.",
      ...(validity.scored ? [] : [`No score published: ${validity.reasons.join("; ")}.`]),
    ],
  };
}
