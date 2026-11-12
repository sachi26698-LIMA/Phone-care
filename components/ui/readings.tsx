import { EvidenceBadge } from "@/components/ui/evidence-badge";
import type { Reading } from "@/lib/types";
import { STATUS_META, cn } from "@/lib/utils";

export function ReadingRow({ reading }: { reading: Reading }) {
  const status = reading.status ?? "neutral";
  const meta = STATUS_META[status];
  return (
    <div className="group flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[46%]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", meta.bar)}
            aria-hidden="true"
            title={meta.label}
          />
          <span className="text-[13.5px] font-medium text-fg">{reading.label}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <EvidenceBadge level={reading.evidence} />
          <span className="text-[11px] text-faint">{reading.source}</span>
        </div>
      </div>
      <div className="min-w-0 sm:max-w-[54%] sm:text-right">
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            reading.value == null ? "text-faint" : status === "bad" ? "text-bad" : status === "warn" ? "text-warn" : "text-fg",
          )}
        >
          {reading.value ?? "Not available"}
        </p>
        {reading.detail ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted sm:ml-auto sm:max-w-[42ch]">
            {reading.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ReadingList({
  readings,
  className,
  emptyLabel = "No readings recorded yet.",
}: {
  readings: Reading[];
  className?: string;
  emptyLabel?: string;
}) {
  if (readings.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-faint">{emptyLabel}</p>
    );
  }
  return (
    <div className={cn("divide-y divide-line-soft", className)}>
      {readings.map((reading) => (
        <ReadingRow key={reading.key} reading={reading} />
      ))}
    </div>
  );
}
