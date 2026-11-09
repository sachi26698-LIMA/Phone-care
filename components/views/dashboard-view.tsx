"use client";

import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  Monitor,
  Radar,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Fingerprint,
  FileBarChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { ModuleCard } from "@/components/diagnostics/module-card";
import { EvidenceLegend } from "@/components/ui/evidence-badge";
import { ProgressBar, Spinner } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { MODULES } from "@/lib/modules";
import { summarizeHealth } from "@/lib/scoring";
import { buildRecommendations } from "@/lib/recommendations";
import { buildBriefing } from "@/lib/assistant";
import { formatTimestamp, scoreBand } from "@/lib/utils";

function reading(state: ReturnType<typeof useDiagnostics>["state"], module: "device", key: string) {
  return state.modules[module]?.readings.find((r) => r.key === key)?.value ?? null;
}

export function DashboardView() {
  const { state, hydrated, runAll, running, batch, progress } = useDiagnostics();
  const health = summarizeHealth(state);
  const recommendations = buildRecommendations(state);
  const briefing = buildBriefing({ state, health, recommendations });
  const band = scoreBand(health.overall);
  const deviceModel = reading(state, "device", "model");
  const deviceOs = reading(state, "device", "os");
  const deviceBrowser = reading(state, "device", "browser");
  const deviceScanned = Boolean(state.modules.device?.completedAt);
  const lastRun = Object.values(state.modules)
    .map((m) => m?.completedAt ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  const critical = recommendations.filter((r) => r.severity === "critical");
  const attention = recommendations.filter((r) => r.severity === "attention");

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                <Radar className="size-3" aria-hidden="true" />
                Live device diagnostics
              </Badge>
              <Badge tone="neutral">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Runs on your device
              </Badge>
            </div>

            <h1 className="mt-5 max-w-xl font-display text-[28px] font-semibold leading-[1.12] tracking-tight sm:text-[38px]">
              Your phone, <span className="text-gradient">measured</span> — not guessed.
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
              Nine diagnostic modules for battery, storage, network, thermal state, display, touch
              and performance. Every value is tagged as measured, estimated, or unavailable, so you
              always know what the browser could actually see.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={() => void runAll()} disabled={Boolean(running)} size="lg">
                {batch.active ? <Spinner className="size-4" /> : <Radar className="size-4" />}
                {batch.active ? "Scanning…" : health.runModules > 0 ? "Re-run full scan" : "Start full scan"}
              </Button>
              <LinkButton href="/diagnostics" variant="secondary" size="lg">
                Browse modules
                <ArrowRight className="size-4" />
              </LinkButton>
            </div>

            {batch.active ? (
              <div className="mt-5 max-w-md space-y-2" aria-live="polite">
                <ProgressBar value={progress?.pct ?? (batch.current / batch.total) * 100} />
                <p className="text-[11.5px] text-muted">
                  Module {batch.current} of {batch.total} · {progress?.message ?? "Preparing"}
                </p>
              </div>
            ) : null}

            <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-soft pt-5 sm:grid-cols-4">
              {[
                {
                  label: "Device",
                  value: deviceModel ?? (deviceScanned ? "Not reported" : "Scan to detect"),
                },
                { label: "Platform", value: deviceOs ?? "—" },
                { label: "Browser", value: deviceBrowser ?? "—" },
                { label: "Last scan", value: lastRun ? formatTimestamp(lastRun) : "Never" },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                    {item.label}
                  </dt>
                  <dd className="mt-1 truncate text-[12.5px] font-medium text-fg" title={item.value}>
                    {hydrated ? item.value : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Health index</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">Weighted across scored modules</p>
            </div>
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
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pt-2">
            <ScoreRing
              score={health.overall}
              sublabel={`${health.confidence}% evidence`}
              provisional={health.provisional}
              size={168}
            />
            <p className="max-w-[26ch] text-center text-[12px] leading-relaxed text-muted">
              {health.runModules === 0
                ? "No modules scanned yet. The index only uses verified data."
                : health.provisional
                  ? `Provisional only: ${health.scorableModules} scored module${health.scorableModules === 1 ? "" : "s"} and ${health.confidence}% evidence. Run the full scan before treating this as a verdict.`
                  : band.note}
            </p>
            <div className="grid w-full grid-cols-3 gap-2 border-t border-line-soft pt-4">
              {[
                { label: "Healthy", value: health.counts.good, tone: "text-good" },
                { label: "Watch", value: health.counts.warn, tone: "text-warn" },
                { label: "Action", value: health.counts.bad, tone: "text-bad" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`font-display text-lg font-semibold tabular-nums ${stat.tone}`}>
                    {health.runModules === 0 ? "—" : stat.value}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* AI briefing */}
      <section className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent/25 to-violet/20 text-accent">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-fg">AI Brain briefing</p>
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-faint">
                  Local reasoning · {briefing.confidence}% confidence
                </p>
              </div>
            </div>
            <p className="mt-4 font-display text-[17px] font-medium leading-snug text-fg">
              {briefing.headline}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{briefing.body}</p>
            <ul className="mt-4 space-y-1.5">
              {briefing.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href="/assistant" variant="secondary" size="sm">
                <Sparkles className="size-3.5" />
                Ask the AI Brain
              </LinkButton>
              <LinkButton href="/results" variant="ghost" size="sm">
                <FileBarChart className="size-3.5" />
                Full report
              </LinkButton>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top findings</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Rule-based, traceable, and linked to guides
              </p>
            </div>
            <Badge tone={critical.length > 0 ? "bad" : attention.length > 0 ? "warn" : "neutral"}>
              {recommendations.length} total
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3">
            {recommendations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-fg">
                  {health.runModules === 0 ? "No scan data yet" : "No findings logged"}
                </p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {health.runModules === 0
                    ? "Run the full scan to generate recommendations."
                    : health.provisional
                      ? "Evidence coverage is too low to surface findings yet. Run the remaining modules."
                      : "Nothing crossed a threshold. Re-scan after a few days to catch drift."}
                </p>
              </div>
            ) : (
              recommendations.slice(0, 3).map((rec) => (
                <Link
                  key={rec.id}
                  href={rec.guide ? `/guides/${rec.guide}` : "/results"}
                  className="block rounded-xl border border-line-soft bg-surface-2/30 p-3.5 transition-colors hover:border-line hover:bg-surface-2/50"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ${
                        rec.severity === "critical"
                          ? "bg-bad/15 text-bad"
                          : rec.severity === "attention"
                            ? "bg-warn/15 text-warn"
                            : "bg-accent/12 text-accent"
                      }`}
                    >
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold leading-snug text-fg">{rec.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                        {rec.body}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Modules */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-fg">
              Diagnostic modules
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Seven automated tests and two guided checks. Nothing requires a permission prompt.
            </p>
          </div>
          <Link
            href="/diagnostics"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
          >
            Module overview
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((meta) => (
            <ModuleCard key={meta.id} meta={meta} />
          ))}
        </div>
      </section>

      {/* Guided checks + evidence */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <span className="grid size-9 place-items-center rounded-xl border border-line-soft bg-surface-2 text-accent">
              <Monitor className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 font-display text-sm font-semibold text-fg">Guided screen check</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Full-screen colour, greyscale, gradient and dead-pixel patterns. You confirm what you
              see; the browser measures geometry and refresh cadence.
            </p>
            <LinkButton href="/diagnostics/screen" variant="outline" size="sm" className="mt-4">
              Open screening
              <ArrowRight className="size-3.5" />
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="grid size-9 place-items-center rounded-xl border border-line-soft bg-surface-2 text-accent">
              <Fingerprint className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 font-display text-sm font-semibold text-fg">Touch & multi-touch map</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Trace a grid to reveal untouched zones and measure how many simultaneous contacts the
              digitiser reports.
            </p>
            <LinkButton href="/diagnostics/touch" variant="outline" size="sm" className="mt-4">
              Open touch test
              <ArrowRight className="size-3.5" />
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="grid size-9 place-items-center rounded-xl border border-line-soft bg-surface-2 text-bad">
              <BatteryCharging className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 font-display text-sm font-semibold text-fg">What can be measured?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              No website can read battery temperature, cycle count, CPU heat or total disk usage.
              We show those as unavailable rather than inventing a number.
            </p>
            <LinkButton href="/methodology" variant="ghost" size="sm" className="mt-4">
              Read the limits
              <ArrowRight className="size-3.5" />
            </LinkButton>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-line-soft bg-surface/40 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
              Evidence legend
            </span>
            <EvidenceLegend />
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            Hover any label to see how that class of reading is obtained.
          </p>
        </div>
      </section>
    </div>
  );
}
