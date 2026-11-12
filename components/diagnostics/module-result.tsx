"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadingList } from "@/components/ui/readings";
import { Note, ProgressBar, Spinner } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { useDiagnostics } from "@/context/diagnostic-provider";
import type { ModuleId } from "@/lib/types";
import { STATUS_META, formatTimestamp } from "@/lib/utils";

export function ModuleResultPanel({
  moduleId,
  title = "Readings",
  emptyHint = "Run the module to populate readings.",
}: {
  moduleId: ModuleId;
  title?: string;
  emptyHint?: string;
}) {
  const { state, running, progress } = useDiagnostics();
  const result = state.modules[moduleId];
  const isRunning = running === moduleId;
  const status = result?.status;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {result?.summary ? (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{result.summary}</p>
          ) : isRunning ? (
            <p className="mt-1.5 text-[12.5px] text-faint">Collecting readings…</p>
          ) : null}
        </div>
        {status && status !== "idle" ? (
          <Badge
            tone={
              status === "complete"
                ? "good"
                : status === "partial"
                  ? "warn"
                  : status === "error"
                    ? "bad"
                    : "accent"
            }
          >
            {status === "complete" ? "Complete" : status === "partial" ? "Partial data" : status === "error" ? "Failed" : status === "unavailable" ? "Unavailable" : "Running"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="pt-2">
        {isRunning ? (
          <div className="space-y-3 py-6" aria-live="polite">
            <div className="flex items-center gap-2 text-[13px] text-accent">
              <Spinner />
              {progress?.moduleId === moduleId ? progress.message : "Collecting readings…"}
            </div>
            <ProgressBar value={progress?.moduleId === moduleId ? progress.pct : 20} />
          </div>
        ) : null}

        {result?.readings.length ? (
          <ReadingList readings={result.readings} />
        ) : !isRunning ? (
          <div className="py-7 text-center">
            <p className="text-[13px] font-medium text-fg">No readings yet</p>
            <p className="mt-1 text-[11.5px] text-faint">{emptyHint}</p>
          </div>
        ) : null}

        {result?.notes && result.notes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {result.notes.map((note) => (
              <Note key={note} tone="neutral">
                {note}
              </Note>
            ))}
          </div>
        ) : null}

        {result && result.readings.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-soft pt-3 text-[11px] text-faint">
            <span>
              {result.readings.filter((r) => r.status === "good").length} healthy
            </span>
            <span>{result.readings.filter((r) => r.status === "warn").length} to watch</span>
            <span>{result.readings.filter((r) => r.status === "bad").length} needing action</span>
            <span className={STATUS_META.neutral.text}>
              {result.readings.filter((r) => r.evidence === "unavailable").length} unavailable
            </span>
            <span className="ml-auto">
              Evidence coverage {Math.round(result.coverage * 100)}%
            </span>
            {result.completedAt ? (
              <span className="w-full text-faint sm:w-auto">
                Captured {formatTimestamp(result.completedAt)}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
