"use client";

import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";
import { isTrain } from "./transport-badge";

// The track of a train or the stand of a bus at a stop of a leg
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
  return (
    <span
      className={cn(
        "shrink-0 rounded-md bg-muted px-1.5 py-px text-[11px] font-semibold text-muted-foreground",
        className
      )}>
      {isTrain(category) ? m.journey.track(platform) : m.stop.platform(platform)}
    </span>
  );
}
