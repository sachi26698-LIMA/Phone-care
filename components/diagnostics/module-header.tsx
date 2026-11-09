"use client";

import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { RunModuleButton } from "@/components/diagnostics/run-module-button";
import { Badge } from "@/components/ui/badge";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { MODULE_MAP } from "@/lib/modules";
import type { ModuleId } from "@/lib/types";
import { formatTimestamp, scoreBand } from "@/lib/utils";

export function ModuleHeader({
  moduleId,
  description,
}: {
  moduleId: ModuleId;
  description?: string;
}) {
  const meta = MODULE_MAP[moduleId];
  const { state } = useDiagnostics();
  const result = state.modules[moduleId];
  const band = scoreBand(result?.score);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">
              Diagnostic module
            </p>
            {result?.completedAt ? (
              <span className="text-[11px] text-faint">
                Last run {formatTimestamp(result.completedAt)}
              </span>
            ) : (
              <Badge tone="neutral">Not scanned</Badge>
            )}
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[30px]">
            {meta.title}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {description ?? meta.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <RunModuleButton moduleId={moduleId} size="md" variant="primary" label="Run module" />
          {result?.score != null ? (
            <p className={`text-[11.5px] font-medium ${band.text}`}>
              {result.score}/100 · {band.label}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-surface-2/25 px-3.5 py-2.5">
        <EvidenceBadge level="measured" showLabel={false} />
        <p className="text-[11.5px] leading-relaxed text-muted">
          <span className="font-medium text-fg">Evidence policy: </span>
          {meta.evidenceNote}
        </p>
      </div>
    </div>
  );
}
