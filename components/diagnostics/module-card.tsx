"use client";

import Link from "next/link";
import { ChevronRight, CircleAlert, CircleCheck, CircleDashed, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModuleIcon } from "@/components/ui/icon";
import { ScoreBar } from "@/components/ui/score-ring";
import { RunModuleButton } from "@/components/diagnostics/run-module-button";
import { useDiagnostics } from "@/context/diagnostic-provider";
import type { ModuleMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ModuleCard({ meta }: { meta: ModuleMeta }) {
  const { state, running, batch } = useDiagnostics();
  const result = state.modules[meta.id];
  const isRunning = running === meta.id || (batch.active && running === meta.id);
  const score = result?.score ?? null;
  const ran = Boolean(result?.completedAt);

  const statusBadge = isRunning ? (
    <Badge tone="accent">
      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      Running
    </Badge>
  ) : result?.status === "error" ? (
    <Badge tone="bad">
      <CircleAlert className="size-3" aria-hidden="true" />
      Failed
    </Badge>
  ) : result?.status === "unavailable" ? (
    <Badge tone="neutral">
      <CircleDashed className="size-3" aria-hidden="true" />
      Unavailable
    </Badge>
  ) : result?.status === "partial" ? (
    <Badge tone="warn">
      <CircleDashed className="size-3" aria-hidden="true" />
      Partial
    </Badge>
  ) : ran ? (
    <Badge tone="good">
      <CircleCheck className="size-3" aria-hidden="true" />
      Complete
    </Badge>
  ) : (
    <Badge tone="neutral">Not scanned</Badge>
  );

  const unavailable = result?.readings.filter((r) => r.evidence === "unavailable").length ?? 0;
  const measured = result?.readings.filter((r) => r.evidence === "measured").length ?? 0;

  return (
    <Card className="group flex flex-col transition-all duration-300 hover:border-line hover:shadow-[0_20px_50px_-30px_rgba(103,232,249,0.35)]">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-line-soft bg-gradient-to-br from-surface-2 to-canvas-deep text-accent transition-colors group-hover:border-accent/30">
          <ModuleIcon name={meta.icon} className="size-[18px]" />
        </div>
        {statusBadge}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4">
        <Link
          href={meta.href}
          className="inline-flex items-center gap-1 font-display text-[15px] font-semibold text-fg transition-colors hover:text-accent"
        >
          {meta.title}
          <ChevronRight className="size-3.5 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
          {meta.description}
        </p>

        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
              {measured} measured{unavailable > 0 ? ` · ${unavailable} unavailable` : ""}
            </span>
            <span
              className={cn(
                "font-display text-[13px] font-semibold tabular-nums",
                score == null ? "text-faint" : score >= 70 ? "text-good" : score >= 50 ? "text-warn" : "text-bad",
              )}
            >
              {score == null ? (ran ? "—" : "idle") : `${score}/100`}
            </span>
          </div>
          <ScoreBar score={score} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
        <Link
          href={meta.href}
          className="text-[11.5px] font-medium text-muted transition-colors hover:text-accent"
        >
          Open module
        </Link>
        {meta.mode === "manual" ? (
          <Link
            href={meta.href}
            className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-fg transition-colors hover:border-accent/50 hover:text-accent"
          >
            Guided test
          </Link>
        ) : (
          <RunModuleButton moduleId={meta.id} />
        )}
      </div>
    </Card>
  );
}
