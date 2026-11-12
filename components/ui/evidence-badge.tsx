import { Badge } from "@/components/ui/badge";
import { EVIDENCE_META } from "@/lib/utils";
import type { EvidenceLevel } from "@/lib/types";

const toneMap = {
  measured: "good",
  estimated: "violet",
  user: "info",
  unavailable: "neutral",
} as const;

export function EvidenceBadge({
  level,
  showLabel = true,
  className,
}: {
  level: EvidenceLevel;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = EVIDENCE_META[level];
  return (
    <Badge
      tone={toneMap[level]}
      className={className}
      title={meta.description}
      aria-label={`Evidence: ${meta.label}. ${meta.description}`}
    >
      <span className={`inline-block size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {showLabel ? meta.short : <span className="sr-only">{meta.label}</span>}
    </Badge>
  );
}

export function EvidenceLegend({ className }: { className?: string }) {
  const order: EvidenceLevel[] = ["measured", "estimated", "user", "unavailable"];
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {order.map((level) => (
        <EvidenceBadge key={level} level={level} />
      ))}
    </div>
  );
}
