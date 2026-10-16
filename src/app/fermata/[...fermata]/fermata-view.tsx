"use client";

import { Bell, BellRing, Footprints, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { LineBadge } from "~/app/components/line-badge";
import { LiveStatus } from "~/app/components/live-status";
import { PageHeader } from "~/app/components/page-header";
import { SkeletonList } from "~/app/components/skeleton-list";
import { useFavorites } from "~/hooks/use-favorites";
import { useGeolocation, useGeolocationGranted } from "~/hooks/use-geolocation";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { findTarget, useTargets } from "~/hooks/use-targets";
import { formatClimb, formatDeparture, formatDistance, town } from "~/lib/format";
import { lineColor } from "~/lib/lines";
import { cn } from "~/lib/utils";
import { useClimb } from "~/terrain/use-climb";
import { distanceMeters, type Position, walkingSeconds } from "~/timer/plan";
import { isScheduled } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";
import {
  type FilterLine,
  filterDepartures,
  type LineChip,
  lineChips,
  lineFilterStore,
  stopKey,
  toggleLine,
  withLines,
} from "~/timetable/line-filter";
import { type Departure, InTimeStatus, type Target } from "~/timetable/models";
import { FallbackDepartures, ServiceUnavailable } from "./fallback-departures";

const noLines: ReadonlyArray<FilterLine> = [];


// Soonest first; departures without a real-time wait by clock time
function byDeparture(a: Departure, b: Departure): number {
  if (a.DepartureAt !== undefined && b.DepartureAt !== undefined) {
    return a.DepartureAt - b.DepartureAt;
  }
  return a.Time.localeCompare(b.Time);
}

// The platforms of the stop, as in the URL
export function FermataView({ fermata }: { fermata: string[] }) {
  const router = useRouter();
  const { data, isLoading, isError } = useMonitored<Departure>(
    "/api/timetable/itineraries",
    "itineraries",
    fermata
  );
  const { isFavorite, toggleFavorite, isLoaded } = useFavorites();
  const stop = findTarget(useTargets(), fermata);
  const now = useNow();
  const timer = useTimer();

  // Only shown when already allowed: never prompt from this page
  const granted = useGeolocationGranted();
  const { position } = useGeolocation(granted);

  // The lines chosen at this stop, remembered for the next visit
  const key = stopKey(fermata);
  const selected = lineFilterStore.useValue()?.[key] ?? noLines;
  const setLines = (lines: ReadonlyArray<FilterLine>) =>
    lineFilterStore.set((filters) => withLines(filters, key, lines));

  const sorted = useMemo(() => [...data].sort(byDeparture), [data]);
  const chips = useMemo(() => lineChips(sorted, selected), [sorted, selected]);
  const departures = useMemo(() => filterDepartures(sorted, selected), [sorted, selected]);
  const currentIsFavorite = isLoaded && isFavorite(fermata);

  const platform = (departure: Departure) =>
    stop?.Coordinates.find((c) => c.Id === departure.Target) ??
    stop?.Coordinates[0];
  const nearest = position && stop && nearestPlatform(stop, position);
  // The walk slows down uphill, as in the timer, at the normal pace of the
  // user (learned from the walks of the timer)
  const climb = useClimb(nearest && position, nearest?.position);
  const climbLabel = formatClimb(climb);
  const walkMinutes =
    nearest &&
    Math.max(1, Math.round(walkingSeconds(nearest.meters, timer.speeds.normal, climb) / 60));

  const startTimer = (departure: Departure) => {
    if (!stop || !isScheduled(departure)) return;
    timer.start(
      departure,
      { name: stop.Name, label: stop.Label, identifiers: fermata },
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
                  identifiers: fermata,
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
          {formatDistance(nearest.meters)}
          {climbLabel && ` ${climbLabel}`} · circa {walkMinutes} min a piedi
        </p>
      )}

      {!isLoading && chips.length > 1 && (
        <LineFilter
          chips={chips}
          onToggle={(line) => setLines(toggleLine(selected, line))}
          onAll={() => setLines([])}
        />
      )}

      {/* The timetable of opendata stands in until the TPL list is back */}
      {isError && data.length === 0 ? (
        stop?.CodeNat ? (
          <FallbackDepartures stationId={stop.CodeNat} now={now} />
        ) : (
          <ServiceUnavailable />
        )
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
          {sorted.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Nessuna partenza nei prossimi minuti
            </li>
          ) : (
            departures.length === 0 && (
              <li className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                {selected.length === 1
                  ? `Nessuna partenza della linea ${selected[0].line} nei prossimi minuti`
                  : "Nessuna partenza delle linee scelte nei prossimi minuti"}
                <button
                  type="button"
                  onClick={() => setLines([])}
                  className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                  Mostra tutte le linee
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </main>
  );
}

// One chip per line, to keep only the chosen ones. Several can be chosen.
function LineFilter({
  chips,
  onToggle,
  onAll,
}: {
  chips: ReadonlyArray<LineChip>;
  onToggle: (line: LineChip) => void;
  onAll: () => void;
}) {
  const filtering = chips.some((chip) => chip.selected);
  return (
    <div
      role="group"
      aria-label="Filtra per linea"
      className="flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none]">
      <button
        type="button"
        aria-pressed={!filtering}
        onClick={onAll}
        className={cn(
          "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
          filtering
            ? "border-border bg-card text-foreground hover:bg-muted"
            : "border-primary bg-primary text-primary-foreground"
        )}>
        Tutte
      </button>
      {chips.map((chip) => (
        <button
          key={chip.route}
          type="button"
          aria-pressed={chip.selected}
          aria-label={
            chip.absent
              ? `Linea ${chip.line}, nessuna partenza ora`
              : `Linea ${chip.line}`
          }
          onClick={() => onToggle(chip)}
          className={cn(
            "shrink-0 rounded-[14px] border-2 p-0.5 transition-colors",
            chip.selected ? undefined : "border-transparent",
            chip.absent && "border-dashed"
          )}
          style={chip.selected ? { borderColor: lineColor(chip.route) } : undefined}>
          {/* Dimmed when left out, or when chosen but not running now */}
          <LineBadge
            img={chip.img}
            route={chip.route}
            line={chip.line}
            size={32}
            className={cn(
              "rounded-[10px] transition-opacity",
              filtering && !chip.selected && "opacity-40 grayscale",
              chip.absent && "opacity-40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function nearestPlatform(
  stop: Target,
  position: Position
): { readonly meters: number; readonly position: Position } | undefined {
  return stop.Coordinates.map(({ Lat, Lon }) => {
    const platform = { lat: Lat, lon: Lon };
    return { meters: distanceMeters(position, platform), position: platform };
  }).reduce<{ meters: number; position: Position } | undefined>(
    (nearest, platform) =>
      nearest === undefined || platform.meters < nearest.meters ? platform : nearest,
    undefined
  );
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
