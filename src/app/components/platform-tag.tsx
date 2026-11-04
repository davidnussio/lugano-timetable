"use client";

import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";
import { isTrain } from "./transport-badge";

// The track of a train or the stand of a bus at a stop of a leg: a chip with
// a tiny label and the number in evidence, like the signs on the platforms
export function PlatformTag({
  platform,
  category,
  changed = false,
  className,
}: {
  readonly platform: string | undefined;
  readonly category: string;
  // The real-time platform is not the one of the timetable: in red
  readonly changed?: boolean;
  readonly className?: string;
}) {
  const { m } = useI18n();
  if (!platform) return null;
  const train = isTrain(category);
  const label = train ? m.journey.track(platform) : m.stop.platform(platform);
  return (
    <span
      aria-label={changed ? m.journey.platformChanged(label) : label}
      className={cn(
        "inline-flex shrink-0 items-stretch self-center overflow-hidden rounded-md border bg-background leading-none shadow-sm",
        changed ? "border-destructive ring-2 ring-destructive/25" : "border-border",
        className
      )}>
      <span
        aria-hidden
        className={cn(
          "flex items-center px-1 text-[9px] font-semibold uppercase tracking-wide",
          changed ? "bg-destructive text-white" : "bg-muted text-muted-foreground"
        )}>
        {train ? m.journey.trackShort : m.journey.standShort}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex min-w-5 items-center justify-center px-1.5 py-[3px] font-mono text-xs font-bold tabular-nums",
          changed ? "text-destructive" : "text-foreground"
        )}>
        {platform}
      </span>
    </span>
  );
}
