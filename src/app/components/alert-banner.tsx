"use client";

import { BellRing, X } from "lucide-react";
import { useNow } from "~/hooks/use-now";
import { cn } from "~/lib/utils";
import { useTimer } from "~/timer/timer-provider";

// Alerts are stale once the next one could be due
const VISIBLE_MS = 60_000;

// The latest timer alert, in the page (notifications may be off)
export function AlertBanner({ className }: { className?: string }) {
  const { timer, dismissAlert } = useTimer();
  const alert = timer?.lastAlert;
  const now = useNow(alert !== undefined);
  if (!alert || now === 0 || now - alert.at > VISIBLE_MS) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in",
        className
      )}>
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{alert.body}</p>
      </div>
      <button
        type="button"
        aria-label="Chiudi avviso"
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        onClick={dismissAlert}>
        <X className="size-4" />
      </button>
    </div>
  );
}
