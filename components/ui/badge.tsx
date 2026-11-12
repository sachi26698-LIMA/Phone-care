import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "violet" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-2/70 text-muted",
  accent: "border-accent/35 bg-accent/10 text-accent",
  good: "border-good/35 bg-good/10 text-good",
  warn: "border-warn/35 bg-warn/10 text-warn",
  bad: "border-bad/40 bg-bad/12 text-bad",
  violet: "border-violet/35 bg-violet/10 text-violet",
  info: "border-info/35 bg-info/10 text-info",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const map: Record<Tone, string> = {
    neutral: "bg-faint",
    accent: "bg-accent",
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
    violet: "bg-violet",
    info: "bg-info",
  };
  return <span className={cn("inline-block size-1.5 rounded-full", map[tone], className)} />;
}
