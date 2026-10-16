"use client";

import { ArrowDownUp, ArrowLeft, ArrowRight, History, LocateFixed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { SkeletonList } from "~/app/components/skeleton-list";
import { StopsHeader } from "~/app/components/stops-header";
import { useFavorites } from "~/hooks/use-favorites";
import { useTargets } from "~/hooks/use-targets";
import type { Connection, Station } from "~/journey/models";
import { journeySearchStore, rememberJourney } from "~/journey/search-store";
import { cn } from "~/lib/utils";
import type { Routine } from "~/routines/models";
import { useTimer } from "~/timer/timer-provider";
import { fetcher } from "~/utils/fetcher";
import { ConnectionCard, sameStart } from "./connection-card";
import { Routines } from "./routines";
import { StationPicker } from "./station-picker";

type Field = "from" | "to";

const LABELS: Record<Field, string> = { from: "Da", to: "A" };

const navButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

export default function JourneyPage() {
  const router = useRouter();
  const timer = useTimer();
  const targets = useTargets();
  const { favorites } = useFavorites();
  const search = journeySearchStore.useValue() ?? { recent: [] };
  const [editing, setEditing] = useState<Field | null>(null);
  const [query, setQuery] = useState("");
  const [nearby, setNearby] = useState(false);
  const deferredQuery = useDeferredValue(query);
  // The start of every page of departures browsed after the first one, the
  // current page last: back to the previous page, the first one from now
  const [pages, setPages] = useState<ReadonlyArray<number>>([]);
  const at = pages.at(-1);
  const input = useRef<HTMLInputElement>(null);

  // The favorite TPL stops, as stops of the timetable
  const favoriteStations = useMemo(
    () =>
      favorites.flatMap((favorite): ReadonlyArray<Station> => {
        const target = targets?.find(
          (t) => t.Identifiers.join(",") === favorite.identifiers.join(",")
        );
        if (!target?.CodeNat) return [];
        const platform = target.Coordinates[0];
        return [
          {
            id: target.CodeNat,
            name: target.Label,
            icon: "bus",
            ...(platform ? { position: { lat: platform.Lat, lon: platform.Lon } } : {}),
          },
        ];
      }),
    [favorites, targets]
  );

  const { from, to } = search;
  const ready = from && to && from.id !== to.id;
  const { data, error, isLoading } = useSWR<ReadonlyArray<Connection>>(
    ready && editing === null
      ? `/api/journey/connections?from=${from.id}&to=${to.id}${at === undefined ? "" : `&at=${at}`}`
      : null,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const edit = (field: Field) => {
    setEditing(field);
    setQuery("");
    setNearby(false);
    // Focused while handling the tap, so that the keyboard opens on iOS
    requestAnimationFrame(() => input.current?.focus());
  };

  const pick = (station: Station) => {
    if (editing === null) return;
    const next = { ...journeySearchStore.get(), [editing]: station };
    journeySearchStore.set(next);
    setPages([]);
    const other: Field = editing === "from" ? "to" : "from";
    if (next[other] === undefined) edit(other);
    else setEditing(null);
  };

  const swap = () => {
    journeySearchStore.set((s) => ({ ...s, from: s.to, to: s.from }));
    setPages([]);
  };

  const start = (connection: Connection) => {
    if (!from || !to) return;
    timer.startJourney(connection, from, to, targets);
    journeySearchStore.set((s) => rememberJourney(s, from, to));
    router.push("/timer");
  };

  const pickRoutine = (routine: Routine) => {
    journeySearchStore.set((s) => ({ ...s, from: routine.from, to: routine.to }));
    setPages([]);
  };

  const timed = timer.timer?.journey?.legs[0];
  const last = data?.at(-1);

  return (
    <main className="flex flex-1 flex-col pb-6">
      <StopsHeader title="Tragitto" current="/tragitto" />

      <div className="px-4 pb-3">
        <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
          <div className="min-w-0 flex-1 divide-y divide-border">
            {(["from", "to"] as const).map((field) => (
              <div key={field} className="flex items-center gap-2 px-2">
                <span className="w-5 shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                  {LABELS[field]}
                </span>
                {editing === field ? (
                  <input
                    ref={input}
                    type="search"
                    value={query}
                    placeholder={field === "from" ? "Partenza" : "Destinazione"}
                    autoComplete="off"
                    enterKeyHint="search"
                    className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setNearby(false);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => edit(field)}
                    className={cn(
                      "h-11 min-w-0 flex-1 truncate text-left text-base",
                      !search[field] && "text-muted-foreground"
                    )}>
                    {search[field]?.name ?? (field === "from" ? "Partenza" : "Destinazione")}
                  </button>
                )}
                {editing === field && (
                  <button
                    type="button"
                    aria-label="Chiudi ricerca"
                    onClick={() => setEditing(null)}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            aria-label="Inverti partenza e destinazione"
            onClick={swap}
            disabled={!from && !to}
            className="grid w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
            <ArrowDownUp className="size-5" />
          </button>
        </div>
        {editing !== null && (
          <button
            type="button"
            aria-pressed={nearby}
            onClick={() => {
              setNearby((value) => !value);
              setQuery("");
            }}
            className={cn(
              "mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              nearby
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            )}>
            <LocateFixed className="size-4" />
            Vicino a me
          </button>
        )}
      </div>

      {editing !== null ? (
        <StationPicker
          query={deferredQuery}
          nearby={nearby}
          favorites={favoriteStations}
          onPick={pick}
        />
      ) : ready ? (
        <section className="space-y-3 px-4">
          {error && !data ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Orari non disponibili, nuovo tentativo in corso…
            </p>
          ) : isLoading && !data ? (
            <SkeletonList rows={4} />
          ) : data && data.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nessun collegamento trovato
            </p>
          ) : (
            <ul className="space-y-2">
              {data?.map((connection) => (
                <ConnectionCard
                  key={connection.legs.map((leg) => `${leg.trip}@${leg.departure.scheduled}`).join("|")}
                  connection={connection}
                  timed={timed !== undefined && sameStart(timed, connection.legs[0])}
                  onStart={() => start(connection)}
                />
              ))}
            </ul>
          )}
          <nav aria-label="Pagine dei collegamenti" className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              disabled={pages.length === 0}
              onClick={() => setPages((value) => value.slice(0, -1))}
              className={navButton}>
              <ArrowLeft className="size-4" />
              Prima
            </button>
            <button
              type="button"
              disabled={pages.length === 0}
              onClick={() => setPages([])}
              className={navButton}>
              Adesso
            </button>
            <button
              type="button"
              disabled={!last}
              onClick={() =>
                last && setPages((value) => [...value, last.legs[0].departure.scheduled + 60_000])
              }
              className={navButton}>
              Più tardi
              <ArrowRight className="size-4" />
            </button>
          </nav>
          <p className="px-2 text-center text-xs text-muted-foreground">
            Orari e ritardi da transport.opendata.ch. Tocca la campanella per
            seguire il tragitto con il timer.
          </p>
          <div className="pt-3">
            <Routines
              from={from}
              to={to}
              connection={pages.length === 0 ? data?.[0] : undefined}
              onPick={pickRoutine}
            />
          </div>
        </section>
      ) : (
        <div className="space-y-5 px-4 pt-1">
          <Routines onPick={pickRoutine} />
          {search.recent.length > 0 ? (
            <section>
              <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="size-3.5" />
                Recenti
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {search.recent.map((journey) => (
                  <li key={`${journey.from.id}-${journey.to.id}`}>
                    <button
                      type="button"
                      onClick={() => journeySearchStore.set((s) => ({ ...s, from: journey.from, to: journey.to }))}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted">
                      <span className="min-w-0 flex-1 truncate font-medium">{journey.from.name}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-right font-medium">{journey.to.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Scegli partenza e destinazione: anche con cambi, treni e bus regionali.
              Il timer ti dirà quando uscire e se le coincidenze reggono.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
