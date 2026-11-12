/**
 * Local-only history for the network lab. Ten runs maximum, in localStorage,
 * never uploaded. The reports are the raw material for before/after comparison.
 */

import type { DiagnosticReport } from "@/lib/diagnostic/schema";
import type { SnapshotMetrics } from "@/lib/diagnostic/compare";
import { runToSnapshot, buildWebReport } from "@/lib/diagnostic/report";
import type { QualityRun } from "@/lib/diagnostic/quality";

export const RUNS_KEY = "phonecare.quality.runs.v1";
const MAX_RUNS = 10;

export interface StoredRun {
  id: string;
  savedAt: string;
  snapshot: SnapshotMetrics;
  report: DiagnosticReport;
}

function isStoredRun(value: unknown): value is StoredRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Partial<StoredRun>;
  return typeof run.id === "string" && typeof run.savedAt === "string" && typeof run.snapshot === "object";
}

export function loadRuns(): StoredRun[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredRun) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: QualityRun): StoredRun[] {
  const report = buildWebReport(run);
  const entry: StoredRun = {
    id: report.id,
    savedAt: report.generatedAt,
    snapshot: runToSnapshot(run),
    report,
  };
  const next = [entry, ...loadRuns().filter((r) => r.id !== entry.id)].slice(0, MAX_RUNS);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked: the caller still sees the run for this session.
    }
  }
  return next;
}

export function removeRun(id: string): StoredRun[] {
  const next = loadRuns().filter((run) => run.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearRuns(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    // ignore
  }
}
