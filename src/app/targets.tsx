"use client";

import { ChevronRight, LocateFixed, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useFavorites } from "~/hooks/use-favorites";
import { useGeolocation } from "~/hooks/use-geolocation";
import { formatDistance, town } from "~/lib/format";
import { cn } from "~/lib/utils";
import { distanceMeters, type Position } from "~/timer/plan";
import type { Target } from "~/timetable/models";

function bySearchValue(search: string): (target: Target) => boolean {
  if (search === "") return () => true;

  const searchValue = search.toLowerCase();
  return (target) =>
    target.Name.toLowerCase().includes(searchValue) ||
    target.Label.toLowerCase().includes(searchValue) ||
    target.Identifiers.some((identifier) =>
      identifier.toLowerCase().includes(searchValue)
    );
}

// Distance to the nearest platform of the stop
function targetDistance(target: Target, position: Position): number | undefined {
  let nearest: number | undefined;
  for (const { Lat, Lon } of target.Coordinates) {
    const meters = distanceMeters(position, { lat: Lat, lon: Lon });
    if (nearest === undefined || meters < nearest) nearest = meters;
  }
  return nearest;
}

interface Row {
  readonly target: Target;
  readonly distance: number | undefined;
}

export interface FiltrableListTargetsProps {
  targets: ReadonlyArray<Target>;
}

export function FiltrableListTargets({
  targets,
}: FiltrableListTargetsProps): React.JSX.Element {
  const [search, setSearch] = useState<string>("");
  const [nearby, setNearby] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { isLoaded, isFavorite } = useFavorites();
  const { position, error } = useGeolocation(nearby);

  const rows = useMemo((): ReadonlyArray<Row> => {
    const filtered = targets
      .filter(bySearchValue(deferredSearch))
      .map((target) => ({
        target,
        distance: position && targetDistance(target, position),
      }));
    if (!position) return filtered;
    return filtered.sort(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
    );
  }, [deferredSearch, targets, position]);

  const favorites = isLoaded
    ? rows.filter((row) => isFavorite(row.target.Identifiers))
    : [];
  const others = isLoaded
    ? rows.filter((row) => !isFavorite(row.target.Identifiers))
    : rows;
  const locating = nearby && !position && !error;

  return (
    <div className="flex flex-col pb-6">
      <header className="px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Lugano Bus
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Fermate</h1>
      </header>

      <div className="sticky top-0 z-20 space-y-2.5 bg-background/85 px-4 pb-3 pt-2 backdrop-blur-xl">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            placeholder="Cerca una fermata"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-11 text-base shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
            onChange={(e) => setSearch(e.target.value)}
          />
          {search !== "" && (
            <button
              type="button"
              aria-label="Cancella ricerca"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={() => setSearch("")}>
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={nearby}
            onClick={() => setNearby((value) => !value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              nearby
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            )}>
            <LocateFixed className={cn("size-4", locating && "animate-pulse")} />
            Vicino a me
          </button>
          {nearby && error && (
            <span className="text-xs text-destructive">
              {error === "denied"
                ? "Posizione non autorizzata"
                : "Posizione non disponibile"}
            </span>
          )}
          {locating && (
            <span className="text-xs text-muted-foreground">Localizzazione…</span>
          )}
        </div>
      </div>

      {favorites.length > 0 && (
        <Section title="Preferiti">
          {favorites.map((row) => (
            <TargetRow key={rowKey(row)} row={row} favorite />
          ))}
        </Section>
      )}

      <Section
        title={position ? "Più vicine" : favorites.length > 0 ? "Tutte le fermate" : undefined}>
        {others.map((row) => (
          <TargetRow key={rowKey(row)} row={row} />
        ))}
        {rows.length === 0 && (
          <li className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nessuna fermata per “{search}”
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-sm font-medium text-primary">
              Cancella ricerca
            </button>
          </li>
        )}
      </Section>
    </div>
  );
}

const rowKey = ({ target }: Row) => target.Label + target.Identifiers.join(",");

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-3">
      {title && (
        <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
        {children}
      </ul>
    </section>
  );
}

function TargetRow({ row, favorite }: { row: Row; favorite?: boolean }) {
  const { target, distance } = row;
  return (
    <li>
      <Link
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 active:bg-muted"
        href={`/fermata/${target.Identifiers.join("/")}`}>
        {favorite && <Star className="size-4 shrink-0 fill-favorite text-favorite" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{target.Name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {town(target.Label)}
          </span>
        </div>
        {distance !== undefined && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {formatDistance(distance)}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
      </Link>
    </li>
  );
}
