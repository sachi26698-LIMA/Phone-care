import { EvidenceBadge } from "@/components/ui/evidence-badge";
import type { Reading } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MetricStrip({
  readings,
  keys,
  columns = 3,
}: {
  readings: Reading[];
  keys: string[];
  columns?: 2 | 3 | 4;
}) {
  const items = keys
    .map((key) => readings.find((r) => r.key === key))
    .filter((r): r is Reading => Boolean(r));
  if (items.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${columns >= 4 ? 180 : 220}px, 1fr))`,
      }}
    >
      {items.map((reading) => (
        <div
          key={reading.key}
          className="rounded-xl border border-line-soft bg-surface-2/50 px-4 py-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-faint">
              {reading.label}
            </p>
            <EvidenceBadge level={reading.evidence} showLabel={false} />
          </div>
          <p
            className={cn(
              "mt-1.5 font-display text-lg font-semibold tracking-tight tabular-nums",
              reading.value == null
                ? "text-faint"
                : reading.status === "bad"
                  ? "text-bad"
                  : reading.status === "warn"
                    ? "text-warn"
                    : "text-fg",
            )}
          >
            {reading.value ?? "—"}
          </p>
          {reading.detail ? (
            <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-faint">
              {reading.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
