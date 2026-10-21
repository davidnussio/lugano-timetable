"use client";

import { ArrowDownUp, ArrowLeft, ArrowRight, History, LocateFixed, Star, Timer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { SkeletonList } from "~/app/components/skeleton-list";
import { StopsHeader } from "~/app/components/stops-header";
import { TransportBadge } from "~/app/components/transport-badge";
import { useFavorites } from "~/hooks/use-favorites";
import { useNow } from "~/hooks/use-now";
import { useTargets } from "~/hooks/use-targets";
import { useI18n } from "~/i18n/i18n-provider";
import type { Connection, Station } from "~/journey/models";
import {
  isFavoriteJourney,
  type JourneySearch,
  journeySearchStore,
  rememberJourney,
  type SavedJourney,
  toggleFavoriteJourney,
} from "~/journey/search-store";
import { cn } from "~/lib/utils";
import { currentLeg, expected, formatTime } from "~/timer/journey";
import { useTimer } from "~/timer/timer-provider";
import { fetcher } from "~/utils/fetcher";
import { ConnectionCard, sameStart } from "./connection-card";
import { FavoriteJourneys } from "./favorite-journeys";
import {
  type ChosenTime,
  chooseTime,
  NOW_CHOSEN,
  SearchTimeButton,
  SearchTimePanel,
} from "./search-time";
import { StationPicker } from "./station-picker";

type Field = "from" | "to";

const navButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

export default function JourneyPage() {
  const router = useRouter();
  const timer = useTimer();
  const { m } = useI18n();
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
  const page = pages.at(-1);
  // Leaving now, or at (or arriving by) the time chosen
  const [when, setWhen] = useState<ChosenTime>(NOW_CHOSEN);
  const [choosingTime, setChoosingTime] = useState(false);

  // On the bus (or train) of the running journey, or waiting for it: the
  // search can start where it gets off, as it arrives there
  const now = useNow(timer.timer?.journey !== undefined);
  const timerLegs = timer.timer?.journey && now > 0 ? timer.legs : undefined;
  const boardedIndex = timerLegs && currentLeg(timerLegs, now);
  const boarded = boardedIndex === undefined ? undefined : timerLegs?.[boardedIndex];
  const onBoard = search.onBoard === true && boarded !== undefined;
  const boardedArrival = boarded && Math.floor(expected(boarded.arrival) / 60_000) * 60_000;

  // The pages after the first one leave after its last connection
  const timeQuery =
    page !== undefined
      ? `&at=${page}`
      : onBoard
        ? `&at=${boardedArrival}`
        : when.at === undefined
          ? ""
          : `&at=${when.at}${when.arrive ? "&arrive=1" : ""}`;
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

  const from = onBoard ? boarded.to : search.from;
  const { to } = search;
  const filled = (next: JourneySearch, field: Field) =>
    field === "to"
      ? next.to !== undefined
      : next.from !== undefined || (next.onBoard === true && boarded !== undefined);
  const ready = from && to && from.id !== to.id;
  const { data, error, isLoading } = useSWR<ReadonlyArray<Connection>>(
    ready && editing === null
      ? `/api/journey/connections?from=${from.id}&to=${to.id}${timeQuery}`
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

  const update = (next: JourneySearch) => {
    if (editing === null) return;
    journeySearchStore.set(next);
    setPages([]);
    const other: Field = editing === "from" ? "to" : "from";
    if (!filled(next, other)) edit(other);
    else setEditing(null);
  };

  // A stop typed or nearby: no longer from the bus of the timer
  const pick = (station: Station) => {
    const current = journeySearchStore.get();
    update(
      editing === "from"
        ? { ...current, from: station, onBoard: undefined }
        : { ...current, to: station }
    );
  };

  const pickOnBoard = () => update({ ...journeySearchStore.get(), onBoard: true });

  const swap = () => {
    journeySearchStore.set((s) => ({ ...s, from: s.to, to: s.from }));
    setPages([]);
  };

  // A new search: the recent and favourite journeys stay
  const clear = () => {
    journeySearchStore.set((s) => ({ ...s, from: undefined, to: undefined, onBoard: undefined }));
    setPages([]);
    setWhen(NOW_CHOSEN);
    setChoosingTime(false);
  };

  const start = (connection: Connection) => {
    if (!from || !to) return;
    // The timer goes on with the bus it follows, then this connection
    if (onBoard && boardedIndex !== undefined) {
      timer.reroute(boardedIndex, connection, to);
      journeySearchStore.set((s) => ({ ...s, onBoard: undefined }));
      router.push("/timer");
      return;
    }
    timer.startJourney(connection, from, to, targets);
    journeySearchStore.set((s) => rememberJourney(s, from, to));
    router.push("/timer");
  };

  const favorite = ready && !onBoard ? isFavoriteJourney(search, from, to) : false;
  const favoriteJourneys = search.favorites ?? [];
  const choose = (journey: SavedJourney) => {
    journeySearchStore.set((s) => ({ ...s, from: journey.from, to: journey.to, onBoard: undefined }));
    setPages([]);
  };

  // The leg after the bus of the timer, when the search starts from it
  const timed =
    onBoard && boardedIndex !== undefined
      ? timerLegs?.[boardedIndex + 1] : timer.timer?.journey?.legs[0];
  const last = data?.at(-1);

  return (
    <main className="flex flex-1 flex-col pb-6">
      <StopsHeader title={m.journey.title} current="/tragitto" />

      <div className="px-4 pb-3">
        <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
          {/* The labels share a column as wide as the longest ("NACH") */}
          <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] divide-y divide-border">
            {(["from", "to"] as const).map((field) => (
              <div
                key={field}
                className="col-span-3 grid grid-cols-subgrid items-center gap-x-2 px-2">
                <span className="col-start-1 text-xs font-semibold uppercase text-muted-foreground">
                  {m.journey[field]}
                </span>
                {editing === field ? (
                  <input
                    ref={input}
                    type="search"
                    value={query}
                    placeholder={field === "from" ? m.journey.fromPlaceholder : m.journey.toPlaceholder}
                    autoComplete="off"
                    enterKeyHint="search"
                    className="col-start-2 h-11 min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
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
                      "col-start-2 h-11 min-w-0 truncate text-left text-base",
                      !search[field] && !(field === "from" && onBoard) && "text-muted-foreground"
                    )}>
                    {field === "from" && onBoard
                      ? m.journey.onBoard(boarded.line, boarded.to.name)
                      : (search[field]?.name ??
                        (field === "from" ? m.journey.fromPlaceholder : m.journey.toPlaceholder))}
                  </button>
                )}
                {editing === field && (
                  <button
                    type="button"
                    aria-label={m.journey.closeSearch}
                    onClick={() => setEditing(null)}
                    className="col-start-3 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* One button for each row: swap them, or start again */}
          <div className="flex w-10 shrink-0 flex-col gap-1">
            <button
              type="button"
              aria-label={m.journey.swap}
              onClick={swap}
              disabled={(!from && !to) || onBoard}
              className="grid flex-1 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
              <ArrowDownUp className="size-5" />
            </button>
            <button
              type="button"
              aria-label={m.journey.clear}
              onClick={clear}
              disabled={!from && !to}
              className="grid flex-1 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
              <X className="size-5" />
            </button>
          </div>
        </div>
        {/* Leaving when the bus of the timer arrives: no time to choose */}
        {editing === null && !onBoard && (
          <div className="mt-2 flex gap-2">
            <SearchTimeButton
              value={when}
              open={choosingTime}
              onToggle={() => setChoosingTime((open) => !open)}
            />
            {ready && (
              <button
                type="button"
                aria-pressed={favorite}
                aria-label={favorite ? m.journey.removeFavorite : m.journey.saveFavorite}
                onClick={() => journeySearchStore.set((s) => toggleFavoriteJourney(s, from, to))}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card shadow-sm transition-colors hover:bg-muted">
                <Star
                  className={cn(
                    "size-5 transition-colors",
                    favorite ? "fill-favorite text-favorite" : "text-muted-foreground"
                  )}
                />
              </button>
            )}
          </div>
        )}
        {editing === null && !onBoard && choosingTime && (
          <div className="mt-2">
            <SearchTimePanel
              value={when}
              onChange={(time) => {
                setWhen(chooseTime(time, Date.now()));
                setPages([]);
              }}
            />
          </div>
        )}
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
            {m.common.nearMe}
          </button>
        )}
      </div>

      {editing !== null ? (
        <>
          {editing === "from" && boarded && query.trim() === "" && !nearby && (
            <section className="px-4 pb-3 pt-1">
              <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Timer className="size-3.5" />
                {m.journey.fromTimer}
              </h2>
              <button
                type="button"
                aria-pressed={onBoard}
                onClick={pickOnBoard}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/60 active:bg-muted",
                  onBoard ? "border-primary" : "border-border"
                )}>
                <TransportBadge
                  line={boarded.line}
                  category={boarded.category}
                  operator={boarded.operator}
                  size={24}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {m.journey.onBoard(boarded.line, boarded.to.name)}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTime(expected(boarded.arrival))}
                </span>
              </button>
            </section>
          )}
          <StationPicker
            query={deferredQuery}
            nearby={nearby}
            favorites={favoriteStations}
            onPick={pick}
          />
        </>
      ) : ready ? (
        <>
          {/* Switch to another saved journey, the one searched marked */}
          {favoriteJourneys.length > 0 && (
            <div className="mb-3 border-b border-border pb-4">
              <FavoriteJourneys
                journeys={favoriteJourneys}
                current={{ from, to }}
                // The journey searched again: unselected, as with the clear button
                onChoose={(journey) =>
                  journey.from.id === from.id && journey.to.id === to.id
                    ? clear()
                    : choose(journey)
                }
              />
            </div>
          )}
          <section className="space-y-3 px-4">
            {error && !data ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {m.journey.unavailable}
              </p>
            ) : isLoading && !data ? (
              <SkeletonList rows={4} />
            ) : data && data.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {m.journey.noConnections}
              </p>
            ) : (
              <ul className="space-y-2">
                {data?.map((connection) => (
                  <ConnectionCard
                    key={connection.legs.map((leg) => `${leg.trip}@${leg.departure.scheduled}`).join("|")}
                    connection={connection}
                    timed={timed !== undefined && sameStart(timed, connection.legs[0])}
                    after={onBoard ? boarded : undefined}
                    onStart={() => start(connection)}
                  />
                ))}
              </ul>
            )}
            <nav aria-label={m.journey.pages} className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={pages.length === 0}
                onClick={() => setPages((value) => value.slice(0, -1))}
                className={navButton}>
                <ArrowLeft className="size-4" />
                {m.journey.earlier}
              </button>
              <button
                type="button"
                disabled={pages.length === 0 && when === NOW_CHOSEN}
                onClick={() => {
                  setPages([]);
                  setWhen(NOW_CHOSEN);
                }}
                className={navButton}>
                {m.journey.now}
              </button>
              <button
                type="button"
                disabled={!last}
                onClick={() =>
                  last && setPages((value) => [...value, last.legs[0].departure.scheduled + 60_000])
                }
                className={navButton}>
                {m.journey.later}
                <ArrowRight className="size-4" />
              </button>
            </nav>
            <p className="px-2 text-center text-xs text-muted-foreground">
              {m.journey.source}
            </p>
          </section>
        </>
      ) : favoriteJourneys.length > 0 || search.recent.length > 0 ? (
        <div className="space-y-4">
          {favoriteJourneys.length > 0 && (
            <FavoriteJourneys journeys={favoriteJourneys} onChoose={choose} />
          )}
          {search.recent.length > 0 && (
            <section className="px-4 pt-1">
              <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="size-3.5" />
                {m.journey.recent}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {search.recent.map((journey) => (
                  <li key={`${journey.from.id}-${journey.to.id}`}>
                    <button
                      type="button"
                      onClick={() => choose(journey)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted">
                      <span className="min-w-0 flex-1 truncate font-medium">{journey.from.name}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-right font-medium">{journey.to.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <p className="px-8 py-10 text-center text-sm text-muted-foreground">
          {m.journey.intro}
        </p>
      )}
    </main>
  );
}
