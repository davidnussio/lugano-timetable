"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNow } from "~/hooks/use-now";
import { formatClock, formatDistance } from "~/lib/format";
import { cn } from "~/lib/utils";
import { getOffHeadline, rideSummary } from "~/timer/get-off";
import { journeyHeadline } from "~/timer/journey";
import { timerHeadline, timerTone, toneText } from "~/timer/tone";
import { useTimer } from "~/timer/timer-provider";
import { AlertBanner } from "./alert-banner";
import { PhaseIcon } from "./phase-icon";
import { TimerBadge } from "./timer-badge";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// Floating summary of the running timer, on every page but the timer itself
export function TimerBar() {
  const { timer, countdown, distance, far, geolocation, legs, stage, ride } = useTimer();
  const pathname = usePathname();
  const now = useNow(timer !== null);

  if (!timer || !countdown || pathname === "/timer") return null;

  const tone = timerTone(countdown, stage);
  // Once on board of a journey: the next transfer or the arrival. Of a
  // single bus: the stop to get off.
  const getOff = timer.journey === undefined ? timer.getOff : undefined;
  const travel =
    now === 0
      ? undefined
      : legs
        ? journeyHeadline(legs, now)
        : getOff && getOffHeadline(getOff, ride, now >= timer.departureAt, now);
  const headline = travel ?? timerHeadline(countdown, stage);
  const accuracy = geolocation.position?.accuracy;
  const where = travel
    ? getOff
      ? lowerFirst(rideSummary(getOff, ride))
      : `verso ${timer.journey?.to.name ?? timer.destination}`
    : stage === "arrived"
      ? `alla fermata ${timer.stop.name}`
      : far !== undefined
        ? `a ${formatDistance(far)} da ${timer.stop.name}`
        : distance === undefined
          ? `da ${timer.stop.name}`
          : accuracy === undefined
            ? `${formatDistance(distance)} da ${timer.stop.name}`
            : `${formatDistance(distance)} (±${Math.round(accuracy)} m) da ${timer.stop.name}`;

  return (
    <>
      {/* Keeps the end of the page reachable above the bar */}
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AlertBanner className="mb-2" />
        <Link
          href="/timer"
          className="flex items-center gap-3 rounded-2xl bg-foreground p-2.5 pr-4 text-background shadow-xl shadow-black/20 transition-transform active:scale-[0.98]">
          <TimerBadge timer={timer} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {timer.journey?.to.name ?? timer.destination}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs opacity-70">
              <PhaseIcon
                phase={headline.phase}
                className={cn("size-3.5 shrink-0", travel ? "text-primary" : toneText[tone])}
              />
              {headline.label} · {where}
            </p>
          </div>
          <span className="font-mono text-xl font-semibold tabular-nums">
            {formatClock(headline.ms)}
          </span>
        </Link>
      </div>
    </>
  );
}
