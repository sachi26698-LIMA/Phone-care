import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-purple">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance font-display text-2xl font-semibold tracking-tight text-fg sm:text-[32px] sm:leading-[1.15]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "good" | "warn" | "bad";
}) {
  const colors = {
    accent: "linear-gradient(90deg, var(--color-accent), var(--color-violet))",
    good: "var(--color-good)",
    warn: "var(--color-warn)",
    bad: "var(--color-bad)",
  } as const;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: colors[tone] }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      role="status"
      aria-label="Working"
    />
  );
}

export function Note({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: "neutral" | "warn" | "bad" | "good" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line-soft bg-surface-2/60 text-muted",
    warn: "border-warn/25 bg-warn/[0.06] text-warn/90",
    bad: "border-bad/30 bg-bad/[0.07] text-bad/90",
    good: "border-good/25 bg-good/[0.06] text-good/90",
    info: "border-info/25 bg-info/[0.06] text-info/90",
  } as const;
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed", tones[tone], className)}>
      {title ? <p className="mb-1 font-semibold text-fg">{title}</p> : null}
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line-soft bg-surface-2/60 text-accent">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function KeyValue({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-fg">{value}</dd>
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em] text-faint", className)}>
      {children}
    </p>
  );
}
