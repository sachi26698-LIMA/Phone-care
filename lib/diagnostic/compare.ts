/**
 * Before/after comparison that refuses to flatter the product.
 *
 * A change is only called an improvement when it exceeds twice the combined
 * measurement uncertainty. Anything inside that band is reported as "no
 * measurable change", which is the honest answer for most router tweaks.
 */

export interface SnapshotMetrics {
  at: string;
  label?: string;
  server?: string | null;
  latencyMedianMs: number | null;
  latencySpreadMs?: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  failureRatePct?: number | null;
  sampleCount?: number | null;
}

export type ChangeDirection = "improved" | "worse" | "no measurable change" | "insufficient data";

export interface MetricChange {
  id: "latency" | "jitter" | "download" | "upload";
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
  deltaPct: number | null;
  /** Half-width of the noise band, in percent. */
  thresholdPct: number;
  direction: ChangeDirection;
  /** Positive is better for the user, regardless of raw sign. */
  betterWhen: "lower" | "higher";
}

export interface ComparisonResult {
  before: SnapshotMetrics;
  after: SnapshotMetrics;
  changes: MetricChange[];
  verdict: ChangeDirection;
  summary: string;
  caveats: string[];
}

const MIN_THRESHOLD_PCT = 5;

function noisePct(metric: "latency" | "jitter" | "download" | "upload", snapshot: SnapshotMetrics): number {
  if (metric === "latency" && snapshot.latencyMedianMs && snapshot.latencyMedianMs > 0 && snapshot.latencySpreadMs) {
    // Two independent runs: sqrt(2) × each run's half-IQR, expressed in percent.
    return Math.max(MIN_THRESHOLD_PCT, (snapshot.latencySpreadMs / snapshot.latencyMedianMs) * 100 * Math.SQRT2);
  }
  // Throughput varies with server load and TCP ramp-up; 5 % is optimistic, 10 % is realistic.
  return metric === "download" || metric === "upload" ? 10 : MIN_THRESHOLD_PCT;
}

function directionFor(
  metric: MetricChange["id"],
  before: number | null,
  after: number | null,
  thresholdPct: number,
  betterWhen: "lower" | "higher",
): { direction: ChangeDirection; deltaPct: number | null } {
  if (before === null || after === null || before <= 0) return { direction: "insufficient data", deltaPct: null };
  const deltaPct = ((after - before) / before) * 100;
  if (Math.abs(deltaPct) <= thresholdPct) return { direction: "no measurable change", deltaPct };
  const improved = betterWhen === "lower" ? deltaPct < 0 : deltaPct > 0;
  return { direction: improved ? "improved" : "worse", deltaPct };
}

export function compareSnapshots(before: SnapshotMetrics, after: SnapshotMetrics): ComparisonResult {
  const definitions: Array<{
    id: MetricChange["id"];
    label: string;
    unit: string;
    before: number | null;
    after: number | null;
    betterWhen: "lower" | "higher";
  }> = [
    { id: "latency", label: "Median latency", unit: "ms", before: before.latencyMedianMs, after: after.latencyMedianMs, betterWhen: "lower" },
    { id: "jitter", label: "Jitter", unit: "ms", before: before.jitterMs, after: after.jitterMs, betterWhen: "lower" },
    { id: "download", label: "Download", unit: "Mbps", before: before.downloadMbps, after: after.downloadMbps, betterWhen: "higher" },
    { id: "upload", label: "Upload", unit: "Mbps", before: before.uploadMbps, after: after.uploadMbps, betterWhen: "higher" },
  ];

  const changes: MetricChange[] = definitions.map((definition) => {
    const thresholdPct = noisePct(definition.id, before);
    const { direction, deltaPct } = directionFor(
      definition.id,
      definition.before,
      definition.after,
      thresholdPct,
      definition.betterWhen,
    );
    return { ...definition, deltaPct, thresholdPct, direction };
  });

  const decided = changes.filter((c) => c.direction !== "insufficient data");
  const improved = decided.filter((c) => c.direction === "improved");
  const worse = decided.filter((c) => c.direction === "worse");
  const verdict: ChangeDirection =
    decided.length === 0
      ? "insufficient data"
      : improved.length === 0 && worse.length === 0
        ? "no measurable change"
        : improved.length > worse.length
          ? "improved"
          : worse.length > improved.length
            ? "worse"
            : "no measurable change";

  const caveats: string[] = [
    "A single pair of tests cannot separate a real improvement from normal variation; repeat both conditions.",
  ];
  if (before.server && after.server && before.server !== after.server) {
    caveats.push("The two runs used different servers, so the comparison is not like for like.");
  }
  if (before.server && after.server && before.server === after.server) {
    caveats.push(`Both runs used ${after.server}.`);
  }
  if ((before.sampleCount ?? 0) < 3 || (after.sampleCount ?? 0) < 3) {
    caveats.push("At least one run has fewer than three samples.");
  }

  const summary =
    verdict === "no measurable change"
      ? `No measurable change: every difference sits inside the measurement noise (±${Math.round(Math.max(...changes.map((c) => c.thresholdPct)))} %).`
      : verdict === "insufficient data"
        ? "Not enough comparable measurements to state a change."
        : `${verdict === "improved" ? "Improvement" : "Regression"} in ${(verdict === "improved" ? improved : worse)
            .map((c) => c.label.toLowerCase())
            .join(", ")}, beyond the noise band.`;

  return { before, after, changes, verdict, summary, caveats };
}
