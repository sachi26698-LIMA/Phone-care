import { cn, scoreBand } from "@/lib/utils";

export function ScoreRing({
  score,
  size = 148,
  stroke = 10,
  label,
  sublabel,
  provisional = false,
  className,
}: {
  score: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  provisional?: boolean;
  className?: string;
}) {
  const band = scoreBand(score);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;
  const id = `ring-${size}-${Math.round(pct)}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        score == null
          ? "No score available"
          : `Health score ${score} out of 100${provisional ? ", provisional: limited evidence" : `, ${band.label}`}`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="55%" stopColor="var(--color-violet)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={score == null ? "var(--color-lavender)" : "var(--color-line-soft)"}
          strokeOpacity={score == null ? 0.45 : 1}
          strokeWidth={score == null ? Math.max(2, stroke - 6) : stroke}
          strokeDasharray={score == null ? "3 9" : undefined}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
          style={{ filter: "drop-shadow(0 3px 6px rgba(106,90,205,0.22))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-3xl font-semibold tabular-nums tracking-tight text-indigo"
          style={{ fontSize: size * 0.24 }}
        >
          {score == null ? "—" : Math.round(score)}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.14em]",
            score == null ? "text-faint" : provisional ? "text-warn" : band.text,
          )}
        >
          {label ?? (score == null ? "Not scored" : provisional ? "Provisional" : band.label)}
        </span>
        {sublabel ? (
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-faint">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ScoreBar({ score, className }: { score: number | null; className?: string }) {
  const band = scoreBand(score);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${score == null ? 0 : Math.max(3, Math.min(100, score))}%`,
          background: `linear-gradient(90deg, var(--color-accent), ${band.stroke})`,
        }}
      />
    </div>
  );
}
