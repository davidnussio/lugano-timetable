"use client";

import { Bell, BellRing, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useGeolocation, useGeolocationGranted } from "~/hooks/use-geolocation";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { useI18n } from "~/i18n/i18n-provider";
import { findTarget } from "~/hooks/use-targets";
import { formatDeparture } from "~/lib/format";
import { cn } from "~/lib/utils";
import { distanceMeters } from "~/timer/plan";
import {
  type FavoriteRide,
  rankRides,
  rideDepartures,
  ridesHintStore,
  ridesStore,
} from "~/timer/rides";
import { isScheduled } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";
import { type Departure, InTimeStatus, type Target } from "~/timetable/models";
import { LineBadge } from "~/app/components/line-badge";

// More would push the stop list off the screen
const SHOWN = 4;

// "Adesso" on the home: the next departures of the favorite rides, the ones
// taken around this time first. Nothing until the local storage is read.
export function NowRides({ targets }: { targets: ReadonlyArray<Target> }) {
  const { m } = useI18n();
  const rides = ridesStore.useValue();
  const hintClosed = ridesHintStore.useValue();
  const now = useNow();
  const hour = now > 0 ? new Date(now).getHours() : undefined;
  // Only when already allowed: never prompt from the home
  const granted = useGeolocationGranted();
  const { position } = useGeolocation(granted);

  const shown = useMemo(() => {
    if (!rides || hour === undefined) return [];
    // Distance to the nearest platform of the stop
    const distanceOf = (ride: FavoriteRide) => {
      const target = position && findTarget(targets, ride.stop.identifiers);
      if (!position || !target || target.Coordinates.length === 0) return undefined;
      return Math.min(
        ...target.Coordinates.map(({ Lat, Lon }) =>
          distanceMeters(position, { lat: Lat, lon: Lon })
        )
      );
    };
    return rankRides(rides, hour, distanceOf).slice(0, SHOWN);
  }, [rides, hour, position, targets]);

  if (rides === null || hintClosed === null || hour === undefined) return null;

  if (rides.length === 0) {
    return hintClosed ? null : <RidesHint />;
  }

  return (
    <section className="px-4 pb-1">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {m.stops.now}
      </h2>
      <ul role="list" className="space-y-2">
        {shown.map((ride) => (
          <RideCard
            key={`${ride.stop.identifiers.join(",")}-${ride.route}-${ride.dir}`}
            ride={ride}
            target={findTarget(targets, ride.stop.identifiers)}
            now={now}
          />
        ))}
      </ul>
    </section>
  );
}

function RidesHint() {
  const { m } = useI18n();
  return (
    <section className="px-4 pb-1">
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/60 py-2.5 pl-3.5 pr-1.5">
        <Star className="mt-0.5 size-4 shrink-0 text-favorite" />
        <p className="flex-1 text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{m.stops.ridesHintTitle}</span>{" "}
          {m.stops.ridesHint}
        </p>
        <button
          type="button"
          aria-label={m.stops.closeHint}
          onClick={() => ridesHintStore.set(true)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
    </section>
  );
}

function RideCard({
  ride,
  target,
  now,
}: {
  ride: FavoriteRide;
  target: Target | undefined;
  now: number;
}) {
  const router = useRouter();
  const timer = useTimer();
  const { m } = useI18n();
  // Same polling (and SWR cache) as the stop page
  const { data, isLoading, isError } = useMonitored<Departure>(
    "/api/timetable/itineraries",
    "itineraries",
    ride.stop.identifiers
  );
  const [next, then] = useMemo(() => rideDepartures(data, ride), [data, ride]);
  // Shown by the ring and the bell: no room for "Timer attivo" beside the
  // next two departures
  const timed =
    next !== undefined && timer.timer?.uid !== undefined && timer.timer.uid === next.Uid;

  // As on the stop page; a running timer is only opened, not started over
  const startTimer = () => {
    if (!next || !isScheduled(next)) return;
    if (!timed) {
      timer.start(
        next,
        ride.stop,
        target?.Coordinates.find((c) => c.Id === next.Target) ?? target?.Coordinates[0]
      );
    }
    router.push("/timer");
  };

  return (
    <li
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        timed ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}>
      <Link
        className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors hover:bg-muted/60 active:bg-muted"
        href={
          // The trip of the next departure, as from the stop page; the stop
          // until the departures are loaded
          next !== undefined
            ? `/routing/${next.Target}/${next.Route}/${next.Dir}/${next.Routing}`
            : `/fermata/${ride.stop.identifiers.join("/")}`
        }>
        <LineBadge img={ride.img} route={ride.route} line={ride.line} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{next?.Dest ?? ride.destination}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{ride.stop.name}</span>
            {next?.Pred === InTimeStatus.Delayed && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">
                {m.common.delay}
              </span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {next !== undefined ? (
            <>
              <When departure={next} now={now} className="text-xl font-bold leading-none" />
              {then !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {m.stops.then} <When departure={then} now={now} className="font-medium" />
                </span>
              )}
            </>
          ) : isLoading && !isError ? (
            <span className="h-6 w-12 animate-pulse rounded-lg bg-muted" aria-label={m.common.loading} />
          ) : (
            <span className="max-w-20 text-right text-xs leading-tight text-muted-foreground">
              {isError ? m.stops.unavailable : m.stops.noDepartures}
            </span>
          )}
        </div>
      </Link>
      {next !== undefined && isScheduled(next) && (
        <button
          type="button"
          onClick={startTimer}
          aria-label={
            timed
              ? m.common.openTimer
              : m.common.startTimer(next.RouteCode, next.Time)
          }
          className={cn(
            "grid w-12 shrink-0 place-items-center border-l border-border transition-colors hover:bg-muted active:bg-muted",
            timed ? "text-primary" : "text-muted-foreground"
          )}>
          {timed ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        </button>
      )}
    </li>
  );
}

// Minutes to the departure as on the stop page, the clock time without a
// real-time wait
function When({
  departure,
  now,
  className,
}: {
  departure: Departure;
  now: number;
  className?: string;
}) {
  const { m } = useI18n();
  const ms = departure.DepartureAt !== undefined ? departure.DepartureAt - now : undefined;
  return (
    <span
      className={cn(
        "tabular-nums",
        ms === undefined && "font-mono",
        ms !== undefined && ms < 2 * 60_000 && "text-warning",
        className
      )}>
      {ms !== undefined ? formatDeparture(m, ms, departure.Time) : departure.Time}
    </span>
  );
}
