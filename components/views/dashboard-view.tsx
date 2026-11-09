"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Check,
  Cpu,
  Database,
  Fingerprint,
  Gauge,
  LayoutGrid,
  Monitor,
  Play,
  Radar,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
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

const TOOL_ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  battery: BatteryCharging,
  database: Database,
  wifi: Wifi,
  thermometer: Thermometer,
  monitor: Monitor,
  touch: Fingerprint,
  compatibility: ShieldCheck,
  performance: Cpu,
};

const TOOL_TONES: Record<string, string> = {
  device: "bg-purple/10 text-purple",
  battery: "bg-amber/15 text-[#9a5a00]",
  storage: "bg-lavender/15 text-[#7d5a8c]",
  network: "bg-info/10 text-info",
  temperature: "bg-bad/[0.08] text-bad",
  screen: "bg-champagne/60 text-[#8a5a1e]",
  touch: "bg-lavender/15 text-[#7d5a8c]",
  compatibility: "bg-good/10 text-good",
  performance: "bg-indigo/[0.07] text-indigo",
};

export function DashboardView() {
  const { state, hydrated, runAll, running, batch, progress } = useDiagnostics();
  const health = summarizeHealth(state);
  const recommendations = buildRecommendations(state);
  const briefing = buildBriefing({ state, health, recommendations });
  const band = scoreBand(health.overall);
  const deviceModel = state.modules.device?.readings.find((r) => r.key === "model")?.value ?? null;
  const deviceOs = state.modules.device?.readings.find((r) => r.key === "os")?.value ?? null;
  const deviceBrowser =
    state.modules.device?.readings.find((r) => r.key === "browser")?.value ?? null;
  const deviceScreen =
    state.modules.device?.readings.find((r) => r.key === "screen")?.value ?? null;
  const deviceScanned = Boolean(state.modules.device?.completedAt);
  const lastRun = Object.values(state.modules)
    .map((m) => m?.completedAt ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  const critical = recommendations.filter((r) => r.severity === "critical");
  const attention = recommendations.filter((r) => r.severity === "attention");

  const batteryLevel = state.modules.battery?.readings.find((r) => r.key === "level")?.value;
  const batteryCharging = state.modules.battery?.readings.find((r) => r.key === "charging")?.value;
  const storageValue =
    state.modules.storage?.readings.find((r) => r.key === "device-free")?.value ??
    state.modules.storage?.readings.find((r) => r.key === "origin-usage")?.value;
  const networkValue = state.modules.network?.readings.find((r) => r.key === "download")?.value;
  const thermalValue = state.modules.temperature?.readings.find((r) => r.key === "throttle")?.value;

  const quickInsights = [
    {
      icon: BatteryCharging,
      label: "Battery",
      value: batteryLevel
        ? `${batteryLevel}${batteryCharging ? ` · ${batteryCharging}` : ""}`
        : "Unavailable in this browser",
    },
    {
      icon: Database,
      label: "Storage",
      value: storageValue ?? "Not measured yet",
    },
    { icon: Wifi, label: "Network", value: networkValue ? `${networkValue} down` : "Not measured yet" },
    {
      icon: Thermometer,
      label: "Thermal",
      value: thermalValue ? `${thermalValue} (inferred)` : "Not measured yet",
    },
    {
      icon: Gauge,
      label: "Performance",
      value:
        state.modules.performance?.score != null
          ? `${state.modules.performance.score}/100 this session`
          : "Not measured yet",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line-soft bg-gradient-to-br from-white via-[#faf6ff] to-[#fdf3e4] shadow-soft">
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-[22rem] rounded-full bg-lavender/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 size-[18rem] rounded-full bg-champagne/40 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-8 p-6 sm:p-9 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/35 bg-amber/12 px-3 py-1 text-[11px] font-semibold text-[#8a5200]">
              <Sparkles className="size-3" aria-hidden="true" />
              AI-powered browser diagnostics
            </span>

            <h1 className="mt-4 max-w-[600px] font-display text-[30px] font-semibold leading-[1.08] tracking-tight text-charcoal sm:text-[34px] lg:text-[38px]">
              Check your phone&rsquo;s <span className="text-gradient">real health</span>.
              <br className="hidden sm:block" /> Not guesswork.
            </h1>
            <p className="mt-3.5 max-w-lg text-[14px] leading-relaxed text-muted">
              Run nine on-device tests for battery, storage, network, thermal stress, display, touch
              and performance. Every value is labelled <strong className="font-semibold text-indigo">measured</strong>,{" "}
              <strong className="font-semibold text-indigo">estimated</strong>, or{" "}
              <strong className="font-semibold text-indigo">unavailable</strong> — so you always know
              what a browser could actually see.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runAll()}
                disabled={Boolean(running)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-purple px-6 text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-14px_rgba(106,90,205,0.9)] transition-all hover:bg-accent-deep active:scale-[0.99] disabled:opacity-60"
              >
                {batch.active ? <Spinner className="size-4" /> : <Play className="size-4" />}
                {batch.active
                  ? "Scanning…"
                  : health.runModules > 0
                    ? "Re-run full scan"
                    : "Run full scan"}
              </button>
              <Link
                href="/assistant"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-amber px-5 text-[14.5px] font-semibold text-charcoal shadow-[0_12px_24px_-16px_rgba(244,166,42,0.9)] transition-all hover:bg-[#e79a1c] active:scale-[0.99]"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                AI Assistant
              </Link>
            </div>

            {batch.active ? (
              <div className="mt-5 max-w-md space-y-2" aria-live="polite">
                <ProgressBar value={progress?.pct ?? (batch.current / batch.total) * 100} />
                <p className="text-[11.5px] text-muted">
                  Module {batch.current} of {batch.total} · {progress?.message ?? "Preparing"}
                </p>
              </div>
            ) : null}

            <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line-soft/80 pt-5 sm:grid-cols-4">
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
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-faint">
                    {item.label}
                  </dt>
                  <dd className="mt-1 truncate text-[12.5px] font-medium text-indigo" title={item.value}>
                    {hydrated ? item.value : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Device illustration + trust points (desktop/tablet only — mobile stays compact) */}
          <div className="hidden flex-col items-center gap-5 sm:flex sm:flex-row sm:justify-center lg:flex-col xl:flex-row">
            <div className="relative w-[148px] shrink-0 sm:w-[168px]">
              <div className="absolute inset-0 -z-10 scale-95 rounded-[2.2rem] bg-lavender/25 blur-2xl" aria-hidden="true" />
              <div className="rounded-[2rem] border-[5px] border-indigo bg-indigo p-1.5 shadow-[0_28px_50px_-24px_rgba(45,43,85,0.55)]">
                <div className="relative aspect-[9/18] overflow-hidden rounded-[1.55rem] bg-gradient-to-b from-purple via-[#8b74d0] to-[#e7c9a2]">
                  <div className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-indigo/50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
                    <span className="grid size-11 place-items-center rounded-full bg-white shadow-[0_10px_20px_-10px_rgba(26,26,31,0.6)]">
                      <Check className="size-6 text-good" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide text-white">
                      Phone health
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9.5px] font-medium text-white backdrop-blur">
                      Runs on-device
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid w-full max-w-[240px] gap-2">
              {[
                { icon: Radar, label: "Real device data" },
                { icon: ShieldCheck, label: "Permission-aware" },
                { icon: Sparkles, label: "Local AI analysis" },
                { icon: Check, label: "Honest & transparent" },
              ].map((point) => (
                <li
                  key={point.label}
                  className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-white/90 px-3 py-2 text-[12px] font-medium text-indigo shadow-[0_1px_2px_rgba(26,26,31,0.03)]"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-surface-2 text-purple">
                    <point.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {point.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Health overview + assistant */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="items-center">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-purple/[0.08] text-purple">
                <LayoutGrid className="size-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-[15.5px]">Device health overview</CardTitle>
                <p className="mt-0.5 text-[11.5px] text-faint">
                  {health.scorableModules === 0
                    ? "No scored modules yet on this browser"
                    : `Based on ${health.scorableModules} scored module${health.scorableModules === 1 ? "" : "s"} on this browser`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-faint sm:block">
                Last updated {lastRun ? formatTimestamp(lastRun) : "—"}
              </span>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 pt-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex flex-col items-center gap-3">
              <ScoreRing
                score={health.overall}
                sublabel={`${health.confidence}% evidence`}
                provisional={health.provisional}
                size={148}
              />
              {health.overall != null ? (
                <Badge tone={health.provisional ? "warn" : health.overall >= 70 ? "good" : "warn"}>
                  {health.provisional ? "Provisional" : band.label}
                </Badge>
              ) : null}
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                {[
                  { label: "Device", value: deviceModel ?? (deviceScanned ? "Not reported" : "Unknown") },
                  { label: "Platform", value: deviceOs ?? "—" },
                  { label: "Browser", value: deviceBrowser ?? "—" },
                  { label: "Screen", value: deviceScreen ?? "—" },
                ].map((fact) => (
                  <div key={fact.label} className="min-w-0 border-b border-line-soft/70 pb-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 truncate text-[12.5px] font-medium text-indigo" title={fact.value}>
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-good/20 bg-good/[0.06] px-3 py-2">
                <span className="grid size-6 place-items-center rounded-full bg-good/12 text-good">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <p className="text-[12px] font-medium text-[#16603c]">
                  {health.runModules === 0
                    ? "No tests run yet on this device"
                    : `${health.runModules} of 9 modules complete · ${health.counts.good} healthy, ${health.counts.warn} to watch, ${health.counts.bad} need action`}
                </p>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                {health.runModules === 0
                  ? "The index only uses verified data. Run a scan to build your report."
                  : health.provisional
                    ? `Provisional: ${health.confidence}% evidence coverage. Run the remaining modules before treating this as a verdict.`
                    : band.note}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href="/results" variant="outline" size="sm">
                  View detailed report
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </LinkButton>
                <LinkButton href="/diagnostics" variant="ghost" size="sm">
                  All modules
                </LinkButton>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-purple/[0.08] text-purple">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <CardTitle className="text-[15.5px]">AI Brain assistant</CardTitle>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/25 bg-good/[0.07] px-2.5 py-1 text-[10.5px] font-medium text-good">
              <span className="size-1.5 rounded-full bg-good" aria-hidden="true" />
              Online
            </span>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-4">
            <p className="text-[12.5px] leading-relaxed text-muted">
              {health.runModules === 0
                ? "Smart explanations, troubleshooting help and personalised suggestions once your readings exist."
                : briefing.headline}
            </p>

            <LinkButton href="/assistant" size="md" className="mt-4 w-full">
              <Sparkles className="size-4" aria-hidden="true" />
              Ask AI Brain
            </LinkButton>

            <div className="mt-5 border-t border-line-soft pt-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                Quick insights
              </p>
              <ul className="mt-2 space-y-0.5">
                {quickInsights.map((insight) => (
                  <li
                    key={insight.label}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <insight.icon className="size-4 shrink-0 text-lavender" aria-hidden="true" />
                    <span className="shrink-0 text-[12px] font-medium text-indigo">
                      {insight.label}:
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-muted">
                      {insight.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Findings (only when there is something to show) */}
      {recommendations.length > 0 ? (
        <Card>
          <CardHeader className="items-center">
            <div>
              <CardTitle className="text-[15.5px]">Top findings</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Rule-based, traceable and linked to research-backed guides
              </p>
            </div>
            <Badge tone={critical.length > 0 ? "bad" : attention.length > 0 ? "warn" : "neutral"}>
              {recommendations.length} total
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.slice(0, 3).map((rec) => (
              <Link
                key={rec.id}
                href={rec.guide ? `/guides/${rec.guide}` : "/results"}
                className="group flex gap-3 rounded-xl border border-line-soft bg-surface-2/50 p-3.5 transition-all hover:border-lavender/60 hover:bg-white hover:shadow-soft"
              >
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                    rec.severity === "critical"
                      ? "bg-bad/10 text-bad"
                      : rec.severity === "attention"
                        ? "bg-amber/15 text-[#9a5a00]"
                        : "bg-purple/10 text-purple"
                  }`}
                >
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-snug text-indigo">{rec.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                    {rec.body}
                  </p>
                </div>
                <ArrowUpRight
                  className="mt-0.5 size-3.5 shrink-0 text-faint transition-colors group-hover:text-purple"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Diagnostic tools */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-indigo">
              Diagnostic tools
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Seven automated tests and two guided checks. No permission prompts are required.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/diagnostics"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-purple hover:underline"
            >
              Module overview
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => void runAll()}
              disabled={Boolean(running)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber px-3.5 text-[12px] font-semibold text-charcoal transition-colors hover:bg-[#e79a1c] disabled:opacity-60"
            >
              <Play className="size-3.5" aria-hidden="true" />
              Run all tests
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 xl:grid-cols-3">
          {MODULES.map((meta) => {
            const Icon = TOOL_ICONS[meta.icon] ?? Smartphone;
            const result = state.modules[meta.id];
            const ran = Boolean(result?.completedAt);
            return (
              <Link
                key={meta.id}
                href={meta.href}
                className="group flex items-center gap-2.5 rounded-2xl border border-line-soft bg-white p-3 shadow-[0_1px_2px_rgba(26,26,31,0.03)] transition-all hover:-translate-y-0.5 hover:border-lavender/60 hover:shadow-soft sm:gap-3.5 sm:p-4"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-11 ${
                    TOOL_TONES[meta.id] ?? "bg-purple/10 text-purple"
                  }`}
                >
                  <Icon className="size-[18px] sm:size-[21px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-[14px] font-semibold text-charcoal">
                      {meta.short === "Device" ? "Device info" : meta.short}
                    </span>
                    {ran ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-good"
                        title="Scanned"
                        aria-label="Scanned"
                      />
                    ) : null}
                  </span>
                  <span className="mt-0.5 hidden line-clamp-1 text-[11.5px] text-muted sm:block">
                    {meta.description}
                  </span>
                </span>
                <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-faint transition-colors group-hover:bg-purple group-hover:text-white sm:grid">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Full module cards (verification detail) */}
      {health.runModules > 0 ? (
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-indigo">
              Module status
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Per-module score, measured evidence and the guided checks that need you.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((meta) => (
            <ModuleCard key={meta.id} meta={meta} />
          ))}
        </div>
      </section>
      ) : null}

      <section className="rounded-2xl border border-line-soft bg-white px-5 py-4 shadow-[0_1px_2px_rgba(26,26,31,0.03)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
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
