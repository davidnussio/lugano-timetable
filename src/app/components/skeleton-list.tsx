export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-2 px-4 pt-3" aria-busy="true" aria-label="Caricamento">
      {Array.from({ length: rows }, (_, row) => (
        <li
          key={row}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="size-11 animate-pulse rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-12 animate-pulse rounded-lg bg-muted" />
        </li>
      ))}
    </ul>
  );
}
