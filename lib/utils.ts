import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EvidenceLevel, ReadingStatus } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatBytes(bytes: number | null | undefined, digits = 1) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${round(value, digits)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${round(ms / 1000, 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatTimestamp(value: number | null | undefined) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const EVIDENCE_META: Record<
  EvidenceLevel,
  { label: string; short: string; description: string; className: string; dot: string }
> = {
  measured: {
    label: "Measured",
    short: "Measured",
    description: "Read live from a browser API or measured by a test in this session.",
    className: "border-good/35 bg-good/10 text-good",
    dot: "bg-good",
  },
  estimated: {
    label: "Estimated",
    short: "Estimate",
    description:
      "Computed or inferred by PhoneCare from other signals. Directionally useful, not a sensor reading.",
    className: "border-violet/35 bg-violet/10 text-violet",
    dot: "bg-violet",
  },
  user: {
    label: "You provided",
    short: "Your input",
    description: "Typed in by you, typically copied from your device settings or a native app.",
    className: "border-info/35 bg-info/10 text-info",
    dot: "bg-info",
  },
  unavailable: {
    label: "Unavailable",
    short: "Unavailable",
    description: "The web platform does not expose this. PhoneCare will not invent a value.",
    className: "border-line bg-surface-2/60 text-faint",
    dot: "bg-faint",
  },
};

export const STATUS_META: Record<
  ReadingStatus,
  { label: string; text: string; bg: string; ring: string; bar: string }
> = {
  good: {
    label: "Healthy",
    text: "text-good",
    bg: "bg-good/10",
    ring: "border-good/35",
    bar: "bg-good",
  },
  warn: {
    label: "Watch",
    text: "text-warn",
    bg: "bg-warn/10",
    ring: "border-warn/35",
    bar: "bg-warn",
  },
  bad: {
    label: "Action needed",
    text: "text-bad",
    bg: "bg-bad/10",
    ring: "border-bad/40",
    bar: "bg-bad",
  },
  neutral: {
    label: "Info",
    text: "text-muted",
    bg: "bg-surface-2",
    ring: "border-line",
    bar: "bg-faint",
  },
};

export function scoreBand(score: number | null | undefined) {
  if (score == null) {
    return {
      label: "Unscored",
      text: "text-faint",
      stroke: "var(--color-faint)",
      note: "Not enough verified data for a score.",
    };
  }
  if (score >= 85)
    return {
      label: "Excellent",
      text: "text-good",
      stroke: "var(--color-good)",
      note: "Signals look healthy for a device of this class.",
    };
  if (score >= 70)
    return {
      label: "Good",
      text: "text-accent",
      stroke: "var(--color-accent)",
      note: "Mostly healthy, with a few things worth watching.",
    };
  if (score >= 50)
    return {
      label: "Fair",
      text: "text-warn",
      stroke: "var(--color-warn)",
      note: "Some signals suggest maintenance would help.",
    };
  return {
    label: "Needs attention",
    text: "text-bad",
    stroke: "var(--color-bad)",
    note: "One or more readings are outside a comfortable range.",
  };
}

export function uid(prefix = "r") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function safeNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}
