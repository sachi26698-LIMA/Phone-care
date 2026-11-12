"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  History,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/misc";
import { ScoreRing } from "@/components/ui/score-ring";
import { runQualityTest, type QualityProgress, type QualityRun } from "@/lib/diagnostic/quality";
import { buildWebReport } from "@/lib/diagnostic/report";
import { serializeReport, type ValidationIssue } from "@/lib/diagnostic/schema";
import { loadRuns, saveRun, clearRuns, type StoredRun } from "@/lib/diagnostic/store";
import { compareSnapshots } from "@/lib/diagnostic/compare";
import { cn } from "@/lib/utils";

function value(v: number | null, unit: string, digits = 0) {
  return v === null ? "—" : `${v.toFixed(digits)} ${unit}`;
}

function MetricCard({
  label,
  valueText,
  detail,
  tone = "neutral",
}: {
  label: string;
  valueText: string;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "text-fg",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  } as const;
  return (
    <div className="rounded-xl border border-line-soft bg-white/70 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className={cn("mt-1 font-display text-[22px] font-semibold leading-none tabular-nums", tones[tone])}>
        {valueText}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{detail}</p>
    </div>
  );
}

function ProbeChart({ run }: { run: QualityRun }) {
  const rtts = run.samples.map((s) => s.rttMs);
  const max = Math.max(1, ...rtts.filter((v): v is number => v !== null));
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`${run.samples.length} individual probe round trips; failed probes are marked separately`}>
        {run.samples.map((sample, index) => {
          const height = sample.rttMs === null ? 100 : Math.max(4, (sample.rttMs / max) * 100);
          return (
            <div
              key={`${sample.index}-${index}`}
              className={cn(
                "flex-1 rounded-t-[2px]",
                sample.rttMs === null ? "bg-bad/50" : sample.index === 0 ? "bg-lavender" : "bg-purple/65",
              )}
              style={{ height: `${height}%` }}
              title={
                sample.rttMs === null
                  ? `Probe ${index + 1}: failed (${sample.failure})`
                  : `Probe ${index + 1}: ${sample.rttMs.toFixed(1)} ms${sample.index === 0 ? " · first probe, excluded from the median" : ""}`
              }
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-lavender" aria-hidden="true" /> first probe (cold connection)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-purple/65" aria-hidden="true" /> measured
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-bad/50" aria-hidden="true" /> failed
        </span>
      </div>
    </div>
  );
}

function ComputeWarning({ items }: { items: string[] }) {
  return (
    <div role="alert" className="rounded-xl border border-warn/30 bg-warn/[0.07] px-4 py-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-warn">
        <AlertTriangle className="size-4" aria-hidden="true" />
        No score published for this run
      </p>
      <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-warn/90">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        The raw numbers are still shown. RFC 6349 §3 says a throughput test on a link that is losing this much is not
        meaningful, so the index is withheld instead of guessed.
      </p>
    </div>
  );
}

export function QualityLab() {
  const [run, setRun] = useState<QualityRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<QualityProgress | null>(null);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; warnings: number }
    | { kind: "invalid"; errors: ValidationIssue[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    setRuns(loadRuns());
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(Boolean(connection?.saveData));
  }, []);

  const report = useMemo(() => (run ? buildWebReport(run) : null), [run]);

  async function handleRun() {
    setBusy(true);
    setStatus({ kind: "idle" });
    setRun(null);
    try {
      const result = await runQualityTest(setProgress);
      setRun(result);
      setRuns(saveRun(result));
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "The test could not start." });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([serializeReport(report)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `phonecare-report-${report.id.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function validateReport() {
    if (!report) return;
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serializeReport(report),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        warnings?: ValidationIssue[];
        errors?: ValidationIssue[];
        error?: string;
      };
      if (response.ok && payload.ok) {
        setStatus({ kind: "ok", warnings: payload.warnings?.length ?? 0 });
      } else if (response.status === 422) {
        setStatus({ kind: "invalid", errors: payload.errors ?? [] });
      } else {
        setStatus({ kind: "error", message: payload.error ?? `Server responded ${response.status}` });
      }
    } catch {
      setStatus({ kind: "error", message: "The report endpoint could not be reached." });
    }
  }

  const latestTwo = runs.slice(0, 2);
  const comparison = latestTwo.length === 2 ? compareSnapshots(latestTwo[1]!.snapshot, latestTwo[0]!.snapshot) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg">Run a measured quality test</p>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
              Eight probes, a 3 MB download, a 2 MB random upload, then two five-probe rounds for stability. Takes
              roughly half a minute on a working connection.
            </p>
            {saveData ? (
              <p className="mt-2 text-[11.5px] text-warn">
                Data Saver is on. The browser may throttle this test; treat the throughput figure as a lower bound.
              </p>
            ) : null}
          </div>
          <Button onClick={handleRun} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            {busy ? "Measuring…" : run ? "Run again" : "Start test"}
          </Button>
        </CardContent>
        {busy && progress ? (
          <CardContent className="border-t border-line-soft pt-4">
            <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
              <span aria-live="polite">{progress.message}</span>
              <span className="tabular-nums text-faint">{Math.round(progress.progress)} %</span>
            </div>
            <ProgressBar value={progress.progress} className="mt-2" />
          </CardContent>
        ) : null}
      </Card>

      {status.kind === "error" ? (
        <div role="alert" className="rounded-xl border border-bad/30 bg-bad/[0.07] px-4 py-3 text-[12.5px] text-bad">
          {status.message}
        </div>
      ) : null}

      {run ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <ScoreRing
                  score={run.scores.total}
                  size={132}
                  label="Link index"
                  sublabel={run.scores.total === null ? "withheld" : "this run"}
                />
                <p className="max-w-[190px] text-center text-[11px] leading-relaxed text-faint">
                  {run.validity.scored
                    ? "Weighted from download, upload, latency and stability. Not a carrier ranking."
                    : "Withheld: the link was too unstable for a meaningful index."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Measured values</CardTitle>
                <Badge tone={run.validity.scored ? "good" : "warn"}>
                  {run.validity.scored ? "Scored" : "Not scored"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-3">
                {!run.validity.scored ? <ComputeWarning items={run.validity.reasons} /> : null}
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Download"
                    valueText={value(run.download?.mbps ?? null, "Mbps", 1)}
                    detail={run.download ? `${(run.download.bytes / 1_000_000).toFixed(1)} MB in ${(run.download.ms / 1000).toFixed(2)} s` : "Transfer did not complete"}
                    tone={run.download ? "good" : "neutral"}
                  />
                  <MetricCard
                    label="Upload"
                    valueText={value(run.upload?.mbps ?? null, "Mbps", 1)}
                    detail={run.upload ? `${(run.upload.bytes / 1_000_000).toFixed(1)} MB in ${(run.upload.ms / 1000).toFixed(2)} s` : "Transfer did not complete"}
                    tone={run.upload ? "good" : "neutral"}
                  />
                  <MetricCard
                    label="Latency (median)"
                    valueText={value(run.latency.medianMs, "ms")}
                    detail={
                      run.latency.spreadMs !== null
                        ? `± ${run.latency.spreadMs.toFixed(1)} ms spread · best ${value(run.latency.minMs, "ms")}`
                        : `${run.latency.succeeded} of ${run.latency.attempted} probes succeeded`
                    }
                    tone={
                      run.latency.medianMs === null
                        ? "neutral"
                        : run.latency.medianMs <= 80
                          ? "good"
                          : run.latency.medianMs <= 150
                            ? "warn"
                            : "bad"
                    }
                  />
                  <MetricCard
                    label="Jitter"
                    valueText={value(run.latency.jitterMs, "ms")}
                    detail={
                      run.stability.cvPct !== null
                        ? `Round-to-round variation ${run.stability.cvPct.toFixed(1)} %${
                            run.stability.rangeMs !== null ? ` · ${run.stability.rangeMs.toFixed(0)} ms spread` : ""
                          } (${run.stability.label})${
                            run.stability.rangeMs !== null && run.stability.rangeMs <= 20 && run.stability.cvPct > 10
                              ? " — under 20 ms of drift counts as stable"
                              : ""
                          }`
                        : "Needs at least two successful rounds"
                    }
                    tone={
                      run.latency.jitterMs === null ? "neutral" : run.latency.jitterMs <= 30 ? "good" : run.latency.jitterMs <= 60 ? "warn" : "bad"
                    }
                  />
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <MetricCard
                    label="Probe failures"
                    valueText={`${run.latency.failureRatePct.toFixed(1)} %`}
                    detail={`${run.latency.failures} of ${run.latency.attempted} failed · HTTP-level, not packet loss`}
                    tone={run.latency.failureRatePct <= 5 ? "good" : "warn"}
                  />
                  <MetricCard
                    label="DNS lookup"
                    valueText={value(run.dnsMs, "ms", 1)}
                    detail={run.dnsMs === null ? "Not exposed for this request (often cached)" : "First probe, Resource Timing"}
                  />
                  <MetricCard
                    label="Time to first byte"
                    valueText={value(run.ttfbMs, "ms", 1)}
                    detail={run.ttfbMs === null ? "Not exposed for this request" : "Server response start"}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Individual probes</CardTitle>
                <Badge tone="neutral">{run.latency.attempted} probes · 3 rounds</Badge>
              </CardHeader>
              <CardContent className="pt-3">
                <ProbeChart run={run} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Server &amp; method</CardTitle>
                <Badge tone="info">same-origin</Badge>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 text-[12.5px] leading-relaxed text-muted">
                <p className="flex items-start gap-2">
                  <Server className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden="true" />
                  <span>{run.server.label}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden="true" />
                  <span>
                    {new Date(run.startedAt).toLocaleString()} · {(run.durationMs / 1000).toFixed(1)} s · transport{" "}
                    {run.transport}
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden="true" />
                  <span>No third-party speed service, no IP lookup, nothing uploaded. The JSON report stays on this device until you choose to validate it.</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Report &amp; contract</CardTitle>
              <Badge tone="violet">phonecare.report/1</Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <p className="text-[12.5px] leading-relaxed text-muted">
                The same report shape the Android app emits. Radio rows are present and null with{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">availability: unsupported</code>, which is
                how this page proves it did not invent signal values.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={downloadReport}>
                  <Download className="size-3.5" aria-hidden="true" />
                  Download JSON
                </Button>
                <Button variant="outline" size="sm" onClick={validateReport}>
                  <FileJson className="size-3.5" aria-hidden="true" />
                  Validate against /api/reports
                </Button>
              </div>
              {status.kind === "ok" ? (
                <p className="flex items-start gap-2 text-[12px] text-good" role="status">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Valid against the shared schema{status.warnings > 0 ? `, with ${status.warnings} warning(s)` : ""}. The
                  server validated and echoed the report without storing it.
                </p>
              ) : null}
              {status.kind === "invalid" ? (
                <div role="alert" className="rounded-xl border border-bad/30 bg-bad/[0.07] px-4 py-3 text-[12px] text-bad">
                  <p className="font-semibold">Rejected by the contract</p>
                  <ul className="mt-1 space-y-0.5">
                    {status.errors.slice(0, 6).map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <code className="text-[11px]">{issue.path}</code> — {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="space-y-1.5 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-faint">
                {run.limitations.map((limitation) => (
                  <li key={limitation}>· {limitation}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {comparison ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Latest two saved runs</CardTitle>
                <Badge tone={comparison.verdict === "improved" ? "good" : comparison.verdict === "worse" ? "bad" : "neutral"}>
                  {comparison.verdict}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                <p className="text-[12.5px] leading-relaxed text-muted">{comparison.summary}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {comparison.changes.map((change) => (
                    <div key={change.id} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2 text-[12px]">
                      <span className="text-muted">{change.label}</span>
                      <span className="tabular-nums text-fg">
                        {change.before?.toFixed(1) ?? "—"} → {change.after?.toFixed(1) ?? "—"} {change.unit}
                        {change.deltaPct !== null ? (
                          <span className={cn("ml-2", change.direction === "improved" ? "text-good" : change.direction === "worse" ? "text-bad" : "text-faint")}>
                            {change.deltaPct > 0 ? "+" : ""}
                            {change.deltaPct.toFixed(0)} %
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-faint">{comparison.caveats.join(" ")}</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <History className="size-4 text-purple" aria-hidden="true" />
            Local run history
          </CardTitle>
          <Badge tone="neutral">{runs.length} saved · this device only</Badge>
        </CardHeader>
        <CardContent className="pt-3">
          {runs.length === 0 ? (
            <p className="text-[12.5px] text-muted">Runs appear here after a test. Nothing leaves this browser.</p>
          ) : (
            <div className="space-y-2">
              <ul className="divide-y divide-line-soft">
                {runs.map((saved) => (
                  <li key={saved.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]">
                    <span className="text-muted">{new Date(saved.savedAt).toLocaleString()}</span>
                    <span className="tabular-nums text-fg">
                      {saved.snapshot.latencyMedianMs?.toFixed(0) ?? "—"} ms · {saved.snapshot.downloadMbps?.toFixed(1) ?? "—"} Mbps
                      {saved.snapshot.label ? ` · ${saved.snapshot.label}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearRuns();
                  setRuns([]);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Clear history
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] leading-relaxed text-faint">
        A single run cannot describe your connection. Compare runs at different times and in different rooms, and read the
        uncertainty beside each number before acting on it.
      </p>
    </div>
  );
}
