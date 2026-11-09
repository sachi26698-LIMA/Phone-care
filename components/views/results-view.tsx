"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  FileBarChart,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { EvidenceLegend } from "@/components/ui/evidence-badge";
import { EmptyState, Note, ProgressBar } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { MODULES } from "@/lib/modules";
import { summarizeHealth } from "@/lib/scoring";
import { buildRecommendations } from "@/lib/recommendations";
import { formatTimestamp, scoreBand } from "@/lib/utils";
import type { EvidenceLevel } from "@/lib/types";

const SEVERITY_TONE = {
  critical: { tone: "bad" as const, label: "Priority" },
  attention: { tone: "warn" as const, label: "Attention" },
  tip: { tone: "info" as const, label: "Tip" },
};

export function ResultsView() {
  const { state, reset, runAll, running, hydrated } = useDiagnostics();
  const [confirming, setConfirming] = useState(false);
  const health = summarizeHealth(state);
  const recommendations = buildRecommendations(state);
  const band = scoreBand(health.overall);

  const completed = MODULES.filter((m) => state.modules[m.id]?.completedAt);
  const report = useMemo(
    () => ({
      product: "PhoneCare AI",
      generatedAt: new Date().toISOString(),
      disclaimer:
        "Browser-based diagnostics. Values are labelled by evidence level. Unavailable metrics are not estimated. This report is not a professional hardware assessment.",
      summary: {
        overallScore: health.overall,
        confidence: health.confidence,
        modulesRun: health.runModules,
        evidenceMix: health.evidenceMix,
      },
      profile: state.profile,
      modules: state.modules,
      recommendations,
    }),
    [state, health, recommendations],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `phonecare-report-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const evidenceOrder: EvidenceLevel[] = ["measured", "estimated", "user", "unavailable"];
  const evidenceTotal =
    evidenceOrder.reduce((sum, level) => sum + health.evidenceMix[level], 0) || 1;

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-2xl border border-line-soft bg-surface/40" />;
  }

  if (completed.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">Report</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-fg sm:text-[30px]">
            Diagnostic report
          </h1>
        </div>
        <EmptyState
          icon={<FileBarChart className="size-5" />}
          title="No report to show yet"
          description="Run the full scan to create a weighted health report with per-module evidence and prioritised recommendations."
          action={
            <Button onClick={() => void runAll()} disabled={Boolean(running)}>
              Run full scan
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">
            Report · {formatTimestamp(state.updatedAt)}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[30px]">
            Diagnostic report
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
            {completed.length} of 9 modules complete · {health.confidence}% evidence coverage. Export
            the JSON for a service centre or print a clean copy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportJson}>
            <Download className="size-3.5" />
            Export JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirming) {
                reset();
                setConfirming(false);
              } else {
                setConfirming(true);
                window.setTimeout(() => setConfirming(false), 4000);
              }
            }}
          >
            <Trash2 className="size-3.5" />
            {confirming ? "Tap again to clear" : "Clear data"}
          </Button>
        </div>
      </div>

      <div className="print-plain space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader>
              <CardTitle>Health index</CardTitle>
              <Badge
                tone={
                  health.overall == null
                    ? "neutral"
                    : health.provisional
                      ? "warn"
                      : health.overall >= 70
                        ? "good"
                        : "warn"
                }
              >
                {health.provisional ? "Provisional" : band.label}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreRing
                score={health.overall}
                size={150}
                sublabel={`${health.confidence}% evidence`}
                provisional={health.provisional}
              />
              <p className="text-center text-[12px] leading-relaxed text-muted">
                {health.provisional
                  ? `Provisional: only ${health.scorableModules} scored module${health.scorableModules === 1 ? "" : "s"} and ${health.confidence}% evidence coverage. Run the full scan for a verdict.`
                  : band.note}
              </p>
              <div className="w-full border-t border-line-soft pt-3">
                <div className="mb-1.5 flex justify-between text-[10.5px] text-faint">
                  <span>Evidence coverage</span>
                  <span>{health.confidence}%</span>
                </div>
                <ProgressBar value={health.confidence} />
                <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                  Weighted by module importance. Unavailable metrics lower coverage instead of
                  contributing a fake score.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Module breakdown</CardTitle>
              <span className="text-[11px] text-faint">{completed.length}/9 complete</span>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="divide-y divide-line-soft">
                {MODULES.map((meta) => {
                  const result = state.modules[meta.id];
                  return (
                    <div key={meta.id} className="flex items-center gap-3 py-2.5">
                      <Link
                        href={meta.href}
                        className="min-w-0 flex-1 text-[12.5px] font-medium text-fg hover:text-accent"
                      >
                        {meta.title}
                      </Link>
                      <span className="hidden w-24 shrink-0 text-[10.5px] uppercase tracking-wide text-faint sm:block">
                        {result?.completedAt
                          ? `${result.readings.filter((r) => r.evidence === "measured").length} measured`
                          : "not run"}
                      </span>
                      {result?.score != null ? (
                        <span
                          className={`w-14 shrink-0 text-right font-display text-[12.5px] font-semibold tabular-nums ${
                            result.score >= 70 ? "text-good" : result.score >= 50 ? "text-warn" : "text-bad"
                          }`}
                        >
                          {result.score}/100
                        </span>
                      ) : (
                        <span className="w-14 shrink-0 text-right text-[11px] text-faint">
                          {result?.completedAt ? "—" : "idle"}
                        </span>
                      )}
                      <div className="hidden w-20 shrink-0 sm:block">
                        <ProgressBar
                          value={result?.score ?? 0}
                          tone={
                            result?.score == null
                              ? "accent"
                              : result.score >= 70
                                ? "good"
                                : result.score >= 50
                                  ? "warn"
                                  : "bad"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="no-print">
          <CardHeader>
            <div>
              <CardTitle>Evidence mix</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                How much of this report is measured versus inferred
              </p>
            </div>
            <EvidenceLegend />
          </CardHeader>
          <CardContent>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {evidenceOrder.map((level) => {
                const pct = (health.evidenceMix[level] / evidenceTotal) * 100;
                const colors: Record<EvidenceLevel, string> = {
                  measured: "var(--color-good)",
                  estimated: "var(--color-violet)",
                  user: "var(--color-info)",
                  unavailable: "var(--color-line)",
                };
                return (
                  <div
                    key={level}
                    style={{ width: `${pct}%`, background: colors[level] }}
                    title={`${level}: ${health.evidenceMix[level]}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {evidenceOrder.map((level) => (
                <div key={level} className="rounded-lg border border-line-soft px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-faint">{level}</p>
                  <p className="font-display text-base font-semibold text-fg">
                    {health.evidenceMix[level]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-fg">Recommendations</h2>
            <Badge tone={recommendations.some((r) => r.severity === "critical") ? "bad" : "neutral"}>
              {recommendations.length} {recommendations.length === 1 ? "item" : "items"}
            </Badge>
          </div>
          {recommendations.length === 0 ? (
            <Note tone="good" title="Nothing crossed a threshold">
              No findings are logged. Keep in mind that absence of findings is only meaningful for the
              modules you have actually run.
            </Note>
          ) : (
            <div className="space-y-2.5">
              {recommendations.map((rec) => {
                const tone = SEVERITY_TONE[rec.severity];
                return (
                  <Card key={rec.id}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone.tone}>
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          {tone.label}
                        </Badge>
                        <p className="font-display text-[14px] font-semibold text-fg">{rec.title}</p>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{rec.body}</p>
                      <ul className="mt-2.5 space-y-1">
                        {rec.actions.map((action) => (
                          <li key={action} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                            <span className="mt-[6px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
                            {action}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-soft pt-2.5">
                        <p className="text-[10.5px] text-faint">Evidence: {rec.evidence}</p>
                        {rec.guide ? (
                          <Link
                            href={`/guides/${rec.guide}`}
                            className="no-print ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          >
                            Open guide
                            <ArrowRight className="size-3" />
                          </Link>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Report metadata</CardTitle>
            <Badge tone="good">
              <ShieldCheck className="size-3" />
              On-device
            </Badge>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
              {[
                { label: "Generated", value: formatTimestamp(Date.now()) },
                { label: "Session started", value: formatTimestamp(state.startedAt) },
                { label: "Modules completed", value: `${completed.length} of 9` },
                { label: "Scored modules", value: String(health.scorableModules) },
                { label: "Evidence coverage", value: `${health.confidence}%` },
                { label: "Data location", value: "Browser localStorage (this device only)" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-3 border-b border-line-soft py-1.5">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="text-right font-medium text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
              {report.disclaimer}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <LinkButton href="/assistant" variant="secondary" size="sm">
          <Sparkles className="size-3.5" />
          Explain this report
        </LinkButton>
        <LinkButton href="/guides" variant="ghost" size="sm">
          Troubleshooting guides
        </LinkButton>
      </div>
    </div>
  );
}
