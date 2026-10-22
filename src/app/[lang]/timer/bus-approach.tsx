"use client";

import { Bus } from "lucide-react";
import { useMonitored } from "~/hooks/use-monitored";
import { useI18n } from "~/i18n/i18n-provider";
import { lineColor } from "~/lib/lines";
import { cn } from "~/lib/utils";
import { approach } from "~/timer/approach";
import type { ActiveTimer } from "~/timer/store";
import type { RoutingStop } from "~/timetable/models";

// Where the bus is on its way to the stop of the user, over the countdown:
// the stop of the user on the right, the stops before it, and on the left
// the road from afar. Gone once the bus has left the stop.
export function BusApproach({ active, now }: { active: ActiveTimer; now: number }) {
  const { m } = useI18n();
  // Same polling (and SWR cache) as the line page and the ride once on board
  const { data, isError } = useMonitored<RoutingStop>(
    "/api/timetable/routing",
    "routing",
    active.routing === "" ? null : [active.target, active.route, active.dir, active.routing]
  );
  const track =
    now === 0 || isError ? undefined : approach(data, active.target, active.departureAt, now);
  if (track === undefined) return null;

  const { stops, away } = track;
  const before = stops.length - 1;
  // A column for the road from afar, one for each stop
  const columns = stops.length + 1;
  // Across the track, in percent: the center of a column, `stops` before the
  // one of the user
  const x = (stopsAway: number) =>
    ((columns - 0.5 - Math.min(stopsAway, before + 1)) / columns) * 100;
  const bus = away ?? before + 1;
  const far = bus >= before + 1;
  const color = lineColor(active.route);
  const summary =
    away === undefined
      ? m.timer.busFar
      : away === 0
        ? m.routing.busAtStop
        : m.timer.stopsBefore(Math.max(1, Math.floor(away)));

  return (
    <div
      role="img"
      aria-label={`${m.timer.whereIsBusNow}: ${summary}`}
      className="mb-5 w-full border-b border-border pb-4">
      <div className="relative h-7">
        {/* The road from afar, fading to the left */}
        <div
          className="absolute top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/40 [mask-image:linear-gradient(to_right,transparent,black_60%)]"
          style={{ left: 0, width: `${x(before)}%` }}
        />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted"
          style={{ left: `${x(before)}%`, right: `${100 - x(0)}%` }}
        />
        {/* Travelled by the bus among the stops shown */}
        {!far && (
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full transition-[width] duration-700 ease-out"
            style={{
              left: `${x(before)}%`,
              width: `${x(bus) - x(before)}%`,
              backgroundColor: color,
            }}
          />
        )}
        {stops.map((stop, index) => {
          const stopsAway = before - index;
          const mine = stopsAway === 0;
          const passed = stopsAway > bus;
          return (
            <span
              key={stop.UID}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card",
                mine ? "size-4 border-[3px] border-primary" : "size-3"
              )}
              style={{
                left: `${x(stopsAway)}%`,
                ...(mine ? {} : { borderColor: color }),
                ...(passed ? { backgroundColor: color } : {}),
              }}
            />
          );
        })}
        <span
          className={cn(
            "absolute top-1/2 z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-md ring-2 ring-card transition-[left] duration-700 ease-out",
            away === undefined && "opacity-60",
            away === 0 && "animate-pulse"
          )}
          style={{ left: `${x(bus)}%`, backgroundColor: color }}>
          <Bus className="size-3.5" />
        </span>
      </div>

      <div className="relative mt-1.5 h-4 text-[11px] leading-4">
        {far && (
          <span
            className="absolute left-0 truncate text-left font-medium text-muted-foreground"
            style={{ width: `${100 / columns}%` }}>
            {away === undefined ? m.timer.busFar : m.timer.stopsBefore(Math.floor(away))}
          </span>
        )}
        {stops.map((stop, index) => {
          const stopsAway = before - index;
          const mine = stopsAway === 0;
          return (
            <span
              key={stop.UID}
              className={cn(
                "absolute -translate-x-1/2 truncate px-0.5 text-center",
                mine ? "font-semibold text-primary" : "text-muted-foreground"
              )}
              style={{ left: `${x(stopsAway)}%`, width: `${100 / columns}%` }}>
              {stop.Name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
