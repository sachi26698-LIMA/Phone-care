"use client";

import { Play, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { cn } from "@/lib/utils";

export function RunScanButton({
  className,
  size = "md",
  fullWidth = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const { runAll, batch, running, cancel, progress, state } = useDiagnostics();
  const hasResults = Object.keys(state.modules).length > 0;

  if (batch.active) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className="flex h-11 items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 text-sm text-accent"
          aria-live="polite"
        >
          <Spinner />
          <span className="tabular-nums">
            {progress?.message ?? `Scanning ${batch.current}/${batch.total}`}
          </span>
          <span className="text-[11px] text-accent/60">{progress ? `${progress.pct}%` : ""}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={cancel} aria-label="Cancel full scan">
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => void runAll()}
      disabled={Boolean(running)}
      size={size}
      className={cn(fullWidth && "w-full", className)}
    >
      {running ? (
        <Spinner className="size-4" />
      ) : hasResults ? (
        <RefreshCw className="size-4" />
      ) : (
        <Play className="size-4" />
      )}
      {hasResults ? "Re-run full scan" : "Run full scan"}
    </Button>
  );
}

export function ScanStatusPill({ className }: { className?: string }) {
  const { state, hydrated } = useDiagnostics();
  const modules = Object.values(state.modules).filter((m) => m?.completedAt);
  const total = 9;
  const coverage = Math.round((modules.length / total) * 100);

  if (!hydrated) {
    return (
      <span
        className={cn(
          "hidden h-8 w-28 animate-pulse rounded-full border border-line bg-surface-2/60 sm:block",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium sm:inline-flex",
        modules.length === 0
          ? "border-line bg-surface-2/50 text-muted"
          : modules.length < 5
            ? "border-warn/30 bg-warn/[0.07] text-warn"
            : "border-good/30 bg-good/[0.07] text-good",
        className,
      )}
      title="Modules completed on this device. Scan data never leaves your browser."
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {modules.length === 0 ? "Not scanned" : `${modules.length}/${total} modules · ${coverage}%`}
    </span>
  );
}
