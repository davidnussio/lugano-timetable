"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatClock, formatDistance } from "~/lib/format";
import { cn } from "~/lib/utils";
import { timerHeadline, timerTone, toneBackground } from "~/timer/tone";
import { useTimer } from "~/timer/timer-provider";
import { AlertBanner } from "./alert-banner";
import { LineBadge } from "./line-badge";

// Floating summary of the running timer, on every page but the timer itself
export function TimerBar() {
  const { timer, countdown, distance, geolocation } = useTimer();
  const pathname = usePathname();

  if (!timer || !countdown || pathname === "/timer") return null;

  const tone = timerTone(countdown);
  const headline = timerHeadline(countdown);
  const accuracy = geolocation.position?.accuracy;
  const where =
    distance === undefined
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
          <LineBadge img={timer.img} route={timer.route} line={timer.line} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{timer.destination}</p>
            <p className="flex items-center gap-1.5 truncate text-xs opacity-70">
              <span className={cn("size-1.5 shrink-0 rounded-full", toneBackground[tone])} />
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
