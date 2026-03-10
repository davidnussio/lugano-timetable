export default function Loading({ rows = 10 }: { rows?: number }) {
  const loadingRows = Array.from({ length: rows }, (_, i) => i);
  return (
    <div className="px-4 pb-4">
      <ul className="divide-y divide-border rounded-xl overflow-hidden bg-card border border-border">
        {loadingRows.map((row) => (
          <li key={row} className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="w-11 h-11 bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="flex flex-col flex-1 gap-2">
                <div className="bg-muted animate-pulse w-3/4 h-5 rounded"></div>
                <div className="bg-muted animate-pulse w-1/2 h-3 rounded"></div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
