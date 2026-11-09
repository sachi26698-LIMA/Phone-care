export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-surface-2/60" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-2/40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl border border-line-soft bg-surface/40" />
        ))}
      </div>
    </div>
  );
}
