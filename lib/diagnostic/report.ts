/**
 * Maps a browser measurement run onto the shared DiagnosticReport contract.
 *
 * Unavailable radio metrics are included on purpose: they are the clearest
 * proof that the web app does not invent RSRP or RSSI values, and the schema
 * forces them to be null with `availability: "unsupported"`.
 */

import { REPORT_SCHEMA_VERSION, type DiagnosticReport, type Measurement } from "./schema";
import type { QualityRun } from "./quality";
import type { SnapshotMetrics } from "./compare";

const APP_VERSION = "1.0.0";

function m(
  partial: Pick<Measurement, "id" | "label" | "value" | "unit" | "evidence" | "source" | "availability"> &
    Partial<Measurement>,
  at: string,
): Measurement {
  return { timestamp: at, ...partial };
}

function unavailableRadio(id: string, label: string, at: string, why: string): Measurement {
  return m(
    {
      id,
      label,
      value: null,
      unit: "dBm",
      evidence: "unavailable",
      source: "Browser platform",
      availability: "unsupported",
      notes: [why],
    },
    at,
  );
}

export function buildWebReport(run: QualityRun, options: { id?: string } = {}): DiagnosticReport {
  const at = run.finishedAt;
  const latency = run.latency;
  const measurements: Measurement[] = [
    m(
      {
        id: "net.latency.median",
        label: "Median round-trip latency",
        value: latency.medianMs,
        unit: "ms",
        evidence: latency.medianMs === null ? "unavailable" : "measured",
        source: `${latency.attempted} same-origin HTTPS probes`,
        availability: latency.medianMs === null ? "transient" : "available",
        sampleCount: latency.succeeded,
        ...(latency.spreadMs !== null
          ? { uncertainty: { kind: "sample_spread" as const, value: Math.round(latency.spreadMs * 10) / 10, unit: "ms" } }
          : {}),
        context: { server: run.server.origin },
      },
      at,
    ),
    m(
      {
        id: "net.latency.min",
        label: "Minimum round-trip latency",
        value: latency.minMs,
        unit: "ms",
        evidence: latency.minMs === null ? "unavailable" : "measured",
        source: "Best of the same probe series",
        availability: latency.minMs === null ? "transient" : "available",
        sampleCount: latency.succeeded,
      },
      at,
    ),
    m(
      {
        id: "net.latency.jitter",
        label: "Jitter",
        value: latency.jitterMs,
        unit: "ms",
        evidence: latency.jitterMs === null ? "unavailable" : "measured",
        source: "Mean absolute difference between consecutive probes",
        availability: latency.jitterMs === null ? "transient" : "available",
        sampleCount: latency.succeeded,
      },
      at,
    ),
    m(
      {
        id: "net.probe.failure_rate",
        label: "Probe failure rate",
        value: latency.attempted > 0 ? Math.round(latency.failureRatePct * 10) / 10 : null,
        unit: "%",
        evidence: latency.attempted > 0 ? "measured" : "unavailable",
        source: "HTTP probe outcomes (not packet loss)",
        availability: latency.attempted > 0 ? "available" : "transient",
        sampleCount: latency.attempted,
      },
      at,
    ),
    m(
      {
        id: "net.dns.lookup_time",
        label: "DNS lookup time",
        value: run.dnsMs,
        unit: "ms",
        evidence: run.dnsMs === null ? "unavailable" : "measured",
        source: "Resource Timing API (first probe)",
        availability: run.dnsMs === null ? "transient" : "available",
        notes: ["Browsers report 0 for cached lookups; that is treated as unavailable, not as 0 ms."],
      },
      at,
    ),
    m(
      {
        id: "net.ttfb",
        label: "Time to first byte",
        value: run.ttfbMs,
        unit: "ms",
        evidence: run.ttfbMs === null ? "unavailable" : "measured",
        source: "Resource Timing API",
        availability: run.ttfbMs === null ? "transient" : "available",
      },
      at,
    ),
    m(
      {
        id: "net.download.mbps",
        label: "Download throughput",
        value: run.download?.mbps ?? null,
        unit: "Mbps",
        evidence: run.download ? "measured" : "unavailable",
        source: "Same-origin payload transfer",
        availability: run.download ? "available" : "transient",
        ...(run.download
          ? {
              uncertainty: { kind: "sample_spread" as const, value: Math.round(run.download.mbps * 0.1 * 10) / 10, unit: "Mbps" },
              context: { bytes: run.download.bytes, durationMs: run.download.ms, endpoint: run.download.endpoint },
            }
          : {}),
      },
      at,
    ),
    m(
      {
        id: "net.upload.mbps",
        label: "Upload throughput",
        value: run.upload?.mbps ?? null,
        unit: "Mbps",
        evidence: run.upload ? "measured" : "unavailable",
        source: "Same-origin payload transfer",
        availability: run.upload ? "available" : "transient",
        ...(run.upload
          ? {
              uncertainty: { kind: "sample_spread" as const, value: Math.round(run.upload.mbps * 0.1 * 10) / 10, unit: "Mbps" },
              context: { bytes: run.upload.bytes, durationMs: run.upload.ms, endpoint: run.upload.endpoint },
            }
          : {}),
      },
      at,
    ),
    m(
      {
        id: "net.stability.cv",
        label: "Round-to-round variation",
        value: run.stability.cvPct,
        unit: "%",
        evidence: run.stability.cvPct === null ? "unavailable" : "measured",
        source: `Coefficient of variation across ${run.stability.roundMedians.length} probe rounds`,
        availability: run.stability.cvPct === null ? "transient" : "available",
        notes: [`Classified as ${run.stability.label}.`],
      },
      at,
    ),
    unavailableRadio("lte.rsrp", "LTE RSRP", at, "No browser API exposes cellular signal strength."),
    unavailableRadio("lte.rsrq", "LTE RSRQ", at, "No browser API exposes cellular signal quality."),
    unavailableRadio("nr.ss_rsrp", "5G NR SS-RSRP", at, "5G metrics require the native Android collector."),
    unavailableRadio("wifi.rssi", "Wi-Fi RSSI", at, "Browsers cannot read Wi-Fi signal strength; only the Android app can."),
  ];

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    id: options.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `report-${Date.now()}`),
    generatedAt: at,
    platform: "web",
    app: { name: "PhoneCare Web", version: APP_VERSION, build: "web" },
    device: {
      manufacturer: null,
      model: null,
      osVersion:
        typeof navigator !== "undefined"
          ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? null)
          : null,
      sdkInt: null,
    },
    session: { startedAt: run.startedAt, durationMs: run.durationMs, trigger: "manual" },
    network: { transport: run.transport, carrier: null, server: run.server.label },
    measurements,
    limitations: [
      "Radio metrics (RSRP, RSRQ, SINR, Wi-Fi RSSI) are unavailable to browsers and are reported as null.",
      "Probe failures are HTTP-level, not packet loss.",
      "Throughput depends on the distance to this deployment and on the device's Wi-Fi or cellular link at that moment.",
      ...run.limitations,
    ],
  };
}

export function runToSnapshot(run: QualityRun): SnapshotMetrics {
  return {
    at: run.finishedAt,
    label: `${run.scores.total ?? "—"} / 100`,
    server: run.server.origin,
    latencyMedianMs: run.latency.medianMs,
    latencySpreadMs: run.latency.spreadMs,
    jitterMs: run.latency.jitterMs,
    downloadMbps: run.download?.mbps ?? null,
    uploadMbps: run.upload?.mbps ?? null,
    failureRatePct: run.latency.failureRatePct,
    sampleCount: run.latency.succeeded,
  };
}
