import type { ModuleResult, Reading } from "@/lib/types";

export function makeResult(
  id: ModuleResult["id"],
  partial: Omit<ModuleResult, "id" | "completedAt"> & { completedAt?: number },
): ModuleResult {
  return {
    id,
    completedAt: Date.now(),
    ...partial,
  };
}

export function unavailableReading(
  key: string,
  label: string,
  source: string,
  detail: string,
): Reading {
  return { key, label, value: null, evidence: "unavailable", source, detail };
}

export function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export function pct(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function bytes(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}
