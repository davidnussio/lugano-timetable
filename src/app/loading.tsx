import { SkeletonList } from "./components/skeleton-list";

export default function LoadingPage() {
  return (
    <div className="pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="space-y-2 px-4 pb-3">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-muted" />
      </div>
      <SkeletonList rows={10} />
    </div>
  );
}
