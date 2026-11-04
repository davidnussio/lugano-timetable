"use client";

import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";
import { isTrain } from "./transport-badge";

// The track of a train or the stand of a bus at a stop of a leg: a chip with
// a tiny label and the number in evidence, like the signs on the platforms
export function PlatformTag({
  platform,
  category,
  className,
}: {
  readonly platform: string | undefined;
  readonly category: string;
  readonly className?: string;
}) {
  const { m } = useI18n();
  if (!platform) return null;
  const train = isTrain(category);
  return (
    <span
      aria-label={train ? m.journey.track(platform) : m.stop.platform(platform)}
      className={cn(
        "inline-flex shrink-0 items-stretch self-center overflow-hidden rounded-md border border-border bg-background leading-none shadow-sm",
        className
      )}>
      <span
        aria-hidden
        className="flex items-center bg-muted px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {train ? m.journey.trackShort : m.journey.standShort}
      </span>
      <span
        aria-hidden
        className="flex min-w-5 items-center justify-center px-1.5 py-[3px] font-mono text-xs font-bold tabular-nums text-foreground">
        {platform}
      </span>
    </span>
  );
}
