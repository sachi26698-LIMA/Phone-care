import type { ModuleResult, Reading, TouchSessionData } from "@/lib/types";
import { makeResult } from "@/lib/collect/common";

export type TouchSession = TouchSessionData;

export function collectTouch(session: TouchSession | null): ModuleResult {
  const readings: Reading[] = [];
  const notes: string[] = [];
  const supportsTouch = navigator.maxTouchPoints > 0;

  readings.push({
    key: "max-points",
    label: "Simultaneous touch points",
    value: supportsTouch ? String(navigator.maxTouchPoints) : "No touch digitiser",
    evidence: "measured",
    source: "navigator.maxTouchPoints",
    detail:
      "The digitiser's reported limit. Multi-finger games and pinch gestures need at least 5.",
    status: supportsTouch ? (navigator.maxTouchPoints >= 5 ? "good" : "warn") : "neutral",
    numeric: navigator.maxTouchPoints,
  });

  readings.push({
    key: "pointer-events",
    label: "Pointer events",
    value: supportsTouch ? "Pointer + touch supported" : "Mouse/pen only",
    evidence: "measured",
    source: "Feature detection",
    status: supportsTouch ? "good" : "neutral",
  });

  if (session) {
    const coveragePct = session.totalCells
      ? Math.round((session.coveredCells / session.totalCells) * 100)
      : 0;
    readings.push(
      {
        key: "coverage",
        label: "Grid coverage",
        value: `${coveragePct}%`,
        evidence: "measured",
        source: "Your live trace",
        detail: `${session.coveredCells} of ${session.totalCells} zones registered input across ${session.maxPoints} simultaneous contact${session.maxPoints === 1 ? "" : "s"}.`,
        status: coveragePct >= 97 ? "good" : coveragePct >= 88 ? "warn" : "bad",
        numeric: coveragePct,
      },
      {
        key: "contacts",
        label: "Peak simultaneous contacts",
        value: String(session.maxPoints),
        evidence: "measured",
        source: "Pointer event tracking",
        status: session.maxPoints >= 2 ? "good" : "warn",
        numeric: session.maxPoints,
      },
      {
        key: "pointer-types",
        label: "Input types seen",
        value: session.pointerTypes.length ? session.pointerTypes.join(", ") : null,
        evidence: session.pointerTypes.length ? "measured" : "unavailable",
        source: "PointerEvent.pointerType",
        status: "neutral",
      },
      {
        key: "duration",
        label: "Trace duration",
        value: `${(session.durationMs / 1000).toFixed(1)} s`,
        evidence: "measured",
        source: "Session timer",
        status: "neutral",
      },
    );

    if (session.missedCells.length > 0) {
      readings.push({
        key: "missed-zones",
        label: "Untouched zones",
        value: String(session.missedCells.length),
        evidence: "measured",
        source: "Grid analysis",
        detail: `Zones: ${session.missedCells.slice(0, 18).join(", ")}${session.missedCells.length > 18 ? "…" : ""}. Untouched zones are not proof of a fault — they may simply not have been drawn over.`,
        status: session.missedCells.length > 0 ? "warn" : "good",
        numeric: session.missedCells.length,
      });
      notes.push(
        "Coverage gaps only become evidence if repeated traces miss the same zones. Run the test twice, drawing slowly over the same areas.",
      );
    }
    if (session.maxPoints < 2) {
      notes.push(
        "Only one contact was registered. If your phone supports multi-touch, try drawing with two or more fingers at once.",
      );
    }
  } else {
    readings.push({
      key: "coverage",
      label: "Grid coverage",
      value: null,
      evidence: "unavailable",
      source: "Guided test",
      detail: "Run the guided trace below to map dead zones and multi-touch behaviour.",
    });
  }

  const coveragePct = session?.totalCells
    ? (session.coveredCells / session.totalCells) * 100
    : null;

  const score =
    session && coveragePct != null
      ? Math.round(Math.min(100, coveragePct * 0.7 + (session.maxPoints >= 5 ? 30 : session.maxPoints >= 2 ? 22 : 10)))
      : null;

  return makeResult("touch", {
    status: session ? "complete" : "partial",
    score,
    coverage: session ? 1 : 0.35,
    readings,
    summary: session
      ? `${Math.round(coveragePct ?? 0)}% grid coverage · peak ${session.maxPoints} contacts · ${session.missedCells.length} untouched zones.`
      : supportsTouch
        ? `Digitiser reports ${navigator.maxTouchPoints} touch points. Run the guided trace to map dead zones.`
        : "No touch digitiser detected. On a desktop this is expected; use a phone or tablet to run the full test.",
    notes,
    durationMs: 0,
  });
}
