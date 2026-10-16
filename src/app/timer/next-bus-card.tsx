"use client";

import { LineBadge } from "~/app/components/line-badge";
import { findTarget, useTargets } from "~/hooks/use-targets";
import { minutesLeft } from "~/timer/plan";
import { useTimer } from "~/timer/timer-provider";
import type { Coordinates } from "~/timetable/models";

// The next run of the line once the bus is missed: one tap moves the timer
// onto it, as if started from the stop page
export function NextBusCard({ now }: { now: number }) {
  const { timer, next, start } = useTimer();
  const stop = findTarget(useTargets(), timer?.stop.identifiers ?? []);
  if (!timer || !next) return null;

  // The platform of the next bus, as on the stop page. Until the stops are
  // loaded, the one of the timer when the bus leaves from there too.
  const platform: Coordinates | undefined =
    stop?.Coordinates.find((c) => c.Id === next.Target) ??
    stop?.Coordinates[0] ??
    (timer.coordinates && next.Target === timer.target
      ? { Id: timer.target, Lat: timer.coordinates.lat, Lon: timer.coordinates.lon }
      : undefined);

  return (
    <section className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <LineBadge img={next.Img} route={next.Route} line={next.RouteCode} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            Prossimo {next.RouteCode} per {next.Dest}
          </p>
          <p className="text-xs text-muted-foreground">
            alle <span className="font-mono tabular-nums">{next.Time}</span> · tra{" "}
            {minutesLeft(next.DepartureAt - now)} min
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => start(next, timer.stop, platform)}
        className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
        Passa a questo bus
      </button>
    </section>
  );
}
