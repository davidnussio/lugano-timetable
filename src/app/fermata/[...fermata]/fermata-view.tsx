"use client";

import { Bell, BellRing, Footprints, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { LineBadge } from "~/app/components/line-badge";
import { LiveStatus } from "~/app/components/live-status";
import { PageHeader } from "~/app/components/page-header";
import { SkeletonList } from "~/app/components/skeleton-list";
import { useFavorites } from "~/hooks/use-favorites";
import { useGeolocation, useGeolocationGranted } from "~/hooks/use-geolocation";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { findTarget, useTargets } from "~/hooks/use-targets";
import { formatDeparture, formatDistance, town } from "~/lib/format";
import { cn } from "~/lib/utils";
import { distanceMeters, walkingSeconds } from "~/timer/plan";
import { isScheduled } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";
import { type Departure, InTimeStatus, type Target } from "~/timetable/models";

type FermatePageProps = {
  params: Promise<{
    fermata: string[];
  }>;
};

// Soonest first; departures without a real-time wait by clock time
function byDeparture(a: Departure, b: Departure): number {
  if (a.DepartureAt !== undefined && b.DepartureAt !== undefined) {
    return a.DepartureAt - b.DepartureAt;
  }
  return a.Time.localeCompare(b.Time);
}

export default function FermatePage(props: FermatePageProps) {
  const params = use(props.params);
  const router = useRouter();
  const { data, isLoading, isError } = useMonitored<Departure>(
    "/api/timetable/itineraries",
    "itineraries",
    params.fermata
  );
  const { isFavorite, toggleFavorite, isLoaded } = useFavorites();
  const stop = findTarget(useTargets(), params.fermata);
  const now = useNow();
  const timer = useTimer();

  // Only shown when already allowed: never prompt from this page
  const granted = useGeolocationGranted();
  const { position } = useGeolocation(granted);

  const departures = useMemo(() => [...data].sort(byDeparture), [data]);
  const currentIsFavorite = isLoaded && isFavorite(params.fermata);

  const platform = (departure: Departure) =>
    stop?.Coordinates.find((c) => c.Id === departure.Target) ??
    stop?.Coordinates[0];
  const nearest = position && stop && nearestPlatform(stop, position);

  const startTimer = (departure: Departure) => {
    if (!stop || !isScheduled(departure)) return;
    timer.start(
      departure,
      { name: stop.Name, label: stop.Label, identifiers: params.fermata },
      platform(departure)
    );
    router.push("/timer");
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        back="/"
        title={stop?.Name ?? "Fermata"}
        subtitle={stop && town(stop.Label)}
        actions={
          stop && (
            <button
              type="button"
              onClick={() =>
                toggleFavorite({
                  name: stop.Name,
                  label: stop.Label,
                  identifiers: params.fermata,
                })
              }
              className="grid size-10 place-items-center rounded-full transition-colors hover:bg-muted"
              aria-pressed={currentIsFavorite}
              aria-label={
                currentIsFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"
              }>
              <Star
                className={cn(
                  "size-5 transition-colors",
                  currentIsFavorite
                    ? "fill-favorite text-favorite"
                    : "text-muted-foreground"
                )}
              />
            </button>
          )
        }
      />

      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prossime partenze
        </h2>
        <LiveStatus error={isError} />
      </div>
      {nearest !== undefined && (
        <p className="flex items-center gap-1.5 px-5 pb-1 text-xs text-muted-foreground">
          <Footprints className="size-3.5" />
          {formatDistance(nearest)} · circa{" "}
          {Math.max(1, Math.round(walkingSeconds(nearest) / 60))} min a piedi
        </p>
      )}

      {isError && data.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Servizio non disponibile, nuovo tentativo in corso…
        </p>
      ) : isLoading ? (
        <SkeletonList />
      ) : (
        <ul role="list" className="space-y-2 px-4 pb-6 pt-2">
          {departures.map((departure) => {
            const timed =
              timer.timer?.uid !== undefined &&
              timer.timer.uid === departure.Uid;
            return (
              <DepartureRow
                key={`${departure.Routing}-${departure.Uid ?? departure.Time}`}
                departure={departure}
                now={now}
                timed={timed}
                onTimer={
                  stop && isScheduled(departure)
                    ? () => startTimer(departure)
                    : undefined
                }
              />
            );
          })}
          {departures.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Nessuna partenza nei prossimi minuti
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

function nearestPlatform(
  stop: Target,
  position: { lat: number; lon: number }
): number | undefined {
  const distances = stop.Coordinates.map(({ Lat, Lon }) =>
    distanceMeters(position, { lat: Lat, lon: Lon })
  );
  return distances.length > 0 ? Math.min(...distances) : undefined;
}

function DepartureRow({
  departure,
  now,
  timed,
  onTimer,
}: {
  departure: Departure;
  now: number;
  timed: boolean;
  onTimer: (() => void) | undefined;
}) {
  const ms =
    departure.DepartureAt !== undefined && now > 0
      ? departure.DepartureAt - now
      : undefined;
  const imminent = ms !== undefined && ms < 2 * 60_000;
  const delayed = departure.Pred === InTimeStatus.Delayed;

  return (
    <li
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        timed ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}>
      <Link
        className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors hover:bg-muted/60 active:bg-muted"
        href={`/routing/${departure.Target}/${departure.Route}/${departure.Dir}/${departure.Routing}`}>
        <LineBadge img={departure.Img} route={departure.Route} line={departure.RouteCode} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{departure.Dest}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{departure.Time}</span>
            {delayed && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">
                Ritardo
              </span>
            )}
            {timed && <span className="font-medium text-primary">Timer attivo</span>}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {ms !== undefined ? (
            <span
              className={cn(
                "text-xl font-bold tabular-nums leading-none",
                imminent ? "text-warning" : "text-foreground"
              )}>
              {formatDeparture(ms, departure.Time)}
            </span>
          ) : (
            <span className="font-mono text-lg font-semibold tabular-nums">
              {departure.Time}
            </span>
          )}
        </div>
      </Link>
      {onTimer && (
        <button
          type="button"
          onClick={onTimer}
          aria-label={`Avvia timer per la linea ${departure.RouteCode} delle ${departure.Time}`}
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
