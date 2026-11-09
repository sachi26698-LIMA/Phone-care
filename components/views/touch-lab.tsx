"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Fingerprint, Hand, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Note, ProgressBar } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import type { TouchSessionData } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLS = 5;
const ROWS = 8;
const TOTAL = COLS * ROWS;
const CELL_LABEL = (row: number, col: number) => `R${row + 1}C${col + 1}`;

export function TouchLab() {
  const { state, saveTouchSession, running } = useDiagnostics();
  const result = state.modules.touch;
  const saved = state.manual.touchSession ?? null;

  const [covered, setCovered] = useState<Set<number>>(() => new Set());
  const [maxPoints, setMaxPoints] = useState(0);
  const [pointerTypes, setPointerTypes] = useState<Set<string>>(() => new Set());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const activePointers = useRef<Set<number>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const supportsTouch =
    typeof navigator !== "undefined" && typeof navigator.maxTouchPoints === "number"
      ? navigator.maxTouchPoints
      : 0;

  const coveragePct = useMemo(() => Math.round((covered.size / TOTAL) * 100), [covered.size]);

  const markAt = useCallback((clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(relX * COLS)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(relY * ROWS)));
    const cell = row * COLS + col;
    setCovered((prev) => {
      if (prev.has(cell)) return prev;
      const next = new Set(prev);
      next.add(cell);
      return next;
    });
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointers.current.add(event.pointerId);
    setMaxPoints((prev) => Math.max(prev, activePointers.current.size));
    setPointerTypes((prev) => {
      const next = new Set(prev);
      next.add(event.pointerType);
      return next;
    });
    setStartedAt((prev) => prev ?? Date.now());
    markAt(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointers.current.size > 0 || event.buttons > 0) {
      markAt(event.clientX, event.clientY);
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
  };

  const reset = () => {
    setCovered(new Set());
    setMaxPoints(0);
    setPointerTypes(new Set());
    setStartedAt(null);
    setSavedAt(null);
    activePointers.current.clear();
  };

  const save = async () => {
    if (covered.size === 0) return;
    const missed: string[] = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (!covered.has(row * COLS + col)) missed.push(CELL_LABEL(row, col));
      }
    }
    const session: TouchSessionData = {
      maxPoints,
      coveredCells: covered.size,
      totalCells: TOTAL,
      missedCells: missed,
      pointerTypes: Array.from(pointerTypes),
      durationMs: startedAt ? Date.now() - startedAt : 0,
    };
    setSaving(true);
    await saveTouchSession(session);
    setSaving(false);
    setSavedAt(Date.now());
  };

  const tone = coveragePct >= 97 ? "text-good" : coveragePct >= 88 ? "text-warn" : "text-bad";

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="touch"
        description="Draw across the grid to map which zones register input. Coverage and contact counts are measured from pointer events; judgements about accuracy stay yours."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Touch grid</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Drag with one finger, then try two or three at once
              </p>
            </div>
            <Badge tone={supportsTouch > 0 ? "accent" : "neutral"}>
              {supportsTouch > 0 ? `${supportsTouch} touch points` : "No touch digitiser"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div
              ref={gridRef}
              className="relative mx-auto w-full max-w-[400px] touch-none select-none overflow-hidden rounded-xl border border-line bg-surface-2"
              style={{ aspectRatio: "3 / 4" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              role="application"
              aria-label="Touch coverage grid. Drag across all 40 zones to map dead areas."
            >
              <div
                className="grid h-full w-full"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: TOTAL }).map((_, i) => {
                  const isCovered = covered.has(i);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-center border-b border-r border-line-soft/60 text-[9px] transition-colors duration-150",
                        isCovered ? "bg-accent/20 text-accent" : "text-transparent",
                        i % COLS === COLS - 1 && "border-r-0",
                        i >= TOTAL - COLS && "border-b-0",
                      )}
                    >
                      {isCovered ? "✓" : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">
                  {covered.size} of {TOTAL} zones covered
                </span>
                <span
                  className={cn(
                    "font-display text-sm font-semibold tabular-nums",
                    coveragePct === 0 ? "text-faint" : tone,
                  )}
                >
                  {coveragePct}%
                </span>
              </div>
              <ProgressBar
                value={coveragePct}
                tone={coveragePct >= 97 ? "good" : coveragePct >= 88 ? "warn" : "bad"}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => void save()} disabled={covered.size === 0 || saving}>
                <Save className="size-4" />
                {saving ? "Saving…" : "Save trace"}
              </Button>
              <Button variant="secondary" onClick={reset}>
                <RotateCcw className="size-4" />
                Clear grid
              </Button>
              {savedAt ? (
                <span className="text-[11.5px] text-good" role="status">
                  Saved — readings updated
                </span>
              ) : null}
            </div>

            {covered.size === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[11px] text-faint">
                <Hand className="size-3.5" aria-hidden="true" />
                {supportsTouch === 0
                  ? "No touch digitiser detected on this device — use a phone or tablet for this test."
                  : "Start drawing anywhere on the grid above."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Zones covered", value: `${covered.size} / ${TOTAL}` },
                { label: "Peak contacts", value: String(maxPoints) },
                { label: "Input types", value: pointerTypes.size ? Array.from(pointerTypes).join(", ") : "—" },
                { label: "Digitiser limit", value: `${supportsTouch} points` },
                {
                  label: "Duration",
                  value: startedAt ? `${Math.round((Date.now() - startedAt) / 1000)} s` : "—",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
                  <span className="text-[11.5px] text-muted">{row.label}</span>
                  <span className="text-[12px] font-medium text-fg">{row.value}</span>
                </div>
              ))}
              <Note tone="info">
                Gaps are not proof of a fault. A single pass often misses corners because of how you
                hold the phone. Repeat the trace before drawing conclusions.
              </Note>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What this test cannot see</CardTitle>
              <ShieldAlert className="size-4 text-faint" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-2 text-[11.5px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">Force sensitivity:</span> browsers receive a
                pointer event, not the digitiser&rsquo;s raw pressure curve on most phones.
              </p>
              <p>
                <span className="font-medium text-fg">Hover / proximity:</span> not usually exposed by
                capacitive panels to the web.
              </p>
              <p>
                <span className="font-medium text-fg">Accuracy in millimetres:</span> pointer
                coordinates are already quantised by the browser.
              </p>
            </CardContent>
          </Card>

          {saved ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-faint">
                  Last saved trace
                </p>
                <p className="mt-1.5 text-[12px] text-fg">
                  {saved.coveredCells}/{saved.totalCells} zones · peak {saved.maxPoints} contacts ·{" "}
                  {(saved.durationMs / 1000).toFixed(1)} s
                </p>
                {saved.missedCells.length > 0 ? (
                  <p className="mt-1 text-[10.5px] leading-relaxed text-faint">
                    Untouched: {saved.missedCells.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-[10.5px] text-good">Full coverage recorded.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ModuleResultPanel
        moduleId="touch"
        title="Touch readings"
        emptyHint="Trace the grid above and save, or run the module to read digitiser capability."
      />

      {running === "touch" ? (
        <p className="flex items-center gap-2 text-[11.5px] text-accent">
          <Fingerprint className="size-3.5" /> Reading digitiser information…
        </p>
      ) : null}
    </div>
  );
}
