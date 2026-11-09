"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Maximize2, Monitor, RotateCcw, Save, X } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import type { ScreenUserCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Pattern {
  id: string;
  label: string;
  instruction: string;
  style: CSSProperties;
  sample?: "text" | "grid";
}

const PATTERNS: Pattern[] = [
  {
    id: "black",
    label: "Black field",
    instruction: "Look for bright spots, grey clouding, or light leaking at the edges.",
    style: { background: "#000000" },
  },
  {
    id: "white",
    label: "White field",
    instruction: "Look for dark patches, yellow tinting, or uneven brightness across the panel.",
    style: { background: "#ffffff" },
  },
  {
    id: "red",
    label: "Red channel",
    instruction: "A failing sub-pixel often shows as a dark line or blotch in one colour only.",
    style: { background: "#ff0000" },
  },
  {
    id: "green",
    label: "Green channel",
    instruction: "Check for uniformity. Slight tint at extreme angles is normal on OLED.",
    style: { background: "#00ff00" },
  },
  {
    id: "blue",
    label: "Blue channel",
    instruction: "Look for dead columns or bright stuck pixels against the blue field.",
    style: { background: "#0000ff" },
  },
  {
    id: "gradient",
    label: "Gradient banding",
    instruction: "The ramp should look smooth. Visible bands suggest reduced colour depth or panel issues.",
    style: {
      background:
        "linear-gradient(90deg, #000000 0%, #1f1f1f 14%, #3d3d3d 28%, #5c5c5c 42%, #7a7a7a 57%, #999999 71%, #b8b8b8 85%, #ffffff 100%)",
    },
  },
  {
    id: "pixels",
    label: "Pixel grid",
    instruction: "Fine grid lines should be sharp and evenly spaced. Stuck pixels appear as coloured dots.",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(0deg, rgba(0,0,0,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.85) 1px, transparent 1px)",
      backgroundSize: "6px 6px, 6px 6px",
    },
    sample: "grid",
  },
  {
    id: "text",
    label: "Text sharpness",
    instruction: "Small text should be crisp. Blurry edges can indicate a scaling setting rather than a fault.",
    style: { background: "#0b0e14" },
    sample: "text",
  },
];

export function ScreenLab() {
  const { state, runModule, saveScreenChecks, running } = useDiagnostics();
  const result = state.modules.screen;
  const measurement = state.manual.display;
  const savedChecks = useMemo(() => state.manual.screenChecks ?? [], [state.manual.screenChecks]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(savedChecks.map((check) => [check.id, check.passed])),
  );
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const pattern = PATTERNS[index]!;
  const answered = Object.keys(answers).length;
  const allAnswered = answered === PATTERNS.length;

  // If the saved checks hydrate after mount, reflect them in the tiles.
  useEffect(() => {
    if (savedChecks.length === 0) return;
    setAnswers((prev) =>
      Object.keys(prev).length > 0
        ? prev
        : Object.fromEntries(savedChecks.map((check) => [check.id, check.passed])),
    );
  }, [savedChecks]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(PATTERNS.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const answer = (passed: boolean) => {
    setAnswers((prev) => ({ ...prev, [pattern.id]: passed }));
    if (index < PATTERNS.length - 1) setIndex(index + 1);
  };

  const reset = () => {
    setAnswers({});
    setIndex(0);
  };

  const save = async () => {
    const checks: ScreenUserCheck[] = PATTERNS.filter((p) => answers[p.id] !== undefined).map((p) => ({
      id: p.id,
      label: p.label,
      passed: answers[p.id]!,
    }));
    setSaving(true);
    await saveScreenChecks(checks);
    setSaving(false);
    close();
  };

  const tryFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen can be blocked in embedded previews; the overlay still works.
    }
  };

  const failedCount = Object.values(answers).filter((v) => !v).length;

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="screen"
        description="Guided full-screen patterns for dead pixels, uniformity and banding. You confirm what you see; PhoneCare records it as your input, never as a sensor reading."
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Guided visual test</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                {PATTERNS.length} patterns · about 60 seconds · works without fullscreen
              </p>
            </div>
            <Badge tone="info">Your input</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-surface-2/30 p-3.5">
              <span className="grid size-9 place-items-center rounded-lg bg-canvas-deep text-accent">
                <Monitor className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-fg">Take your time</p>
                <p className="text-[11px] leading-relaxed text-muted">
                  Turn brightness up and remove screen protectors before judging uniformity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {PATTERNS.map((p, i) => {
                const verdict = answers[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      setOpen(true);
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[10.5px] font-medium transition-colors",
                      verdict === true
                        ? "border-good/40 bg-good/10 text-good"
                        : verdict === false
                          ? "border-bad/40 bg-bad/10 text-bad"
                          : "border-line-soft text-muted hover:border-line hover:text-fg",
                    )}
                  >
                    {p.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line-soft bg-canvas-deep/40 px-3.5 py-2.5">
              <p className="text-[11.5px] text-muted">
                {answered === 0
                  ? "No checks completed yet"
                  : `${answered}/${PATTERNS.length} checks · ${failedCount} defect${failedCount === 1 ? "" : "s"} reported`}
              </p>
              {answered > 0 ? (
                <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-fg">
                  <RotateCcw className="size-3" aria-hidden="true" />
                  Reset
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setIndex(0);
                  setOpen(true);
                }}
              >
                <Maximize2 className="size-4" />
                {answered > 0 ? "Review patterns" : "Start visual test"}
              </Button>
              <Button variant="secondary" onClick={() => void save()} disabled={answered === 0 || saving}>
                <Save className="size-4" />
                {saving ? "Saving…" : "Save results"}
              </Button>
            </div>

            {failedCount > 0 ? (
              <Note tone="bad">
                You reported {failedCount} defect{failedCount === 1 ? "" : "s"}. Photograph the screen
                with another device — panel faults do not appear in screenshots.
              </Note>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Measured display</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">Reported by the browser, not by your eyes</p>
            </div>
            <Badge tone="good">Measured</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {measurement ? (
              <>
                {[
                  { label: "CSS resolution", value: `${measurement.cssWidth} × ${measurement.cssHeight} px` },
                  { label: "Physical pixels", value: `${measurement.physicalWidth} × ${measurement.physicalHeight} px` },
                  { label: "Pixel ratio", value: `${measurement.dpr.toFixed(2)}×` },
                  { label: "Colour depth", value: `${measurement.colorDepth}-bit` },
                  { label: "Gamut", value: measurement.p3 ? "Display-P3" : "sRGB" },
                  { label: "HDR", value: measurement.hdr ? "High dynamic range" : "Standard dynamic range" },
                  { label: "Refresh (inferred)", value: measurement.refreshHz ? `~${measurement.refreshHz} Hz` : "Unavailable" },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
                    <span className="text-[11.5px] text-muted">{row.label}</span>
                    <span className="text-[12px] font-medium tabular-nums text-fg">{row.value}</span>
                  </div>
                ))}
              </>
            ) : (
              <p className="py-6 text-center text-[12px] text-faint">
                Run the screen module to sample display timing and density.
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => void runModule("screen")}
              disabled={Boolean(running)}
            >
              <RotateCcw className="size-3.5" />
              Re-measure display
            </Button>
          </CardContent>
        </Card>
      </div>

      <ModuleResultPanel
        moduleId="screen"
        title="Screen readings"
        emptyHint="Run a display measurement, then complete the visual checks to score the panel."
      />

      {savedChecks.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-faint">
              Saved confirmations
            </span>
            {savedChecks.map((check) => (
              <Badge key={check.id} tone={check.passed ? "good" : "bad"}>
                {check.passed ? <Check className="size-3" /> : <X className="size-3" />}
                {check.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Screen test: ${pattern.label}`}
          className="fixed inset-0 z-[60] flex flex-col"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#07090f] px-4 py-2.5 text-white">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">
                {index + 1}/{PATTERNS.length} · {pattern.label}
              </p>
              <p className="truncate text-[10.5px] text-white/60">{pattern.instruction}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => void tryFullscreen()} className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Enter fullscreen">
                <Maximize2 className="size-4" />
              </button>
              <button ref={closeRef} type="button" onClick={close} className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close screen test">
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1" style={pattern.style}>
            {pattern.sample === "grid" ? (
              <div className="absolute inset-0" aria-hidden="true" />
            ) : null}
            {pattern.sample === "text" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
                <p className="font-display text-[26px] font-semibold leading-tight">
                  Sharp text, 26 px
                </p>
                <p className="max-w-sm text-[13px] leading-relaxed text-white/80">
                  This paragraph is rendered at body size. Edges should look clean at normal viewing
                  distance. Compare it with the small text below.
                </p>
                <p className="text-[10px] tracking-wide text-white/60">
                  10 px · The quick brown fox jumps over the lazy dog · 0123456789
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-[#07090f] px-3 py-3 sm:px-5">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-white disabled:opacity-30"
                aria-label="Previous pattern"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => answer(true)}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-good/90 text-[12.5px] font-semibold text-black transition-colors hover:bg-good"
              >
                <Check className="size-4" />
                Looks correct
              </button>
              <button
                type="button"
                onClick={() => answer(false)}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-bad/60 bg-bad/20 text-[12.5px] font-semibold text-bad transition-colors hover:bg-bad/30"
              >
                <X className="size-4" />
                Report defect
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(PATTERNS.length - 1, i + 1))}
                disabled={index === PATTERNS.length - 1}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-white disabled:opacity-30"
                aria-label="Next pattern"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            {allAnswered ? (
              <div className="mx-auto mt-2 flex max-w-2xl justify-center">
                <button
                  type="button"
                  onClick={() => void save()}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-accent hover:underline"
                >
                  All patterns reviewed — save results
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </div>
  );
}
