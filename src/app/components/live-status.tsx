"use client";

import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";

// "In tempo reale" pulse, or the reconnection message
export function LiveStatus({ error }: { error: boolean }) {
  const { m } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="relative flex size-2">
        {!error && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            error ? "bg-warning" : "bg-success"
          )}
        />
      </span>
      {error ? m.common.reconnecting : m.common.live}
    </span>
  );
}
