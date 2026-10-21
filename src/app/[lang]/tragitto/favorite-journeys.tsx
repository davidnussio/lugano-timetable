"use client";

import { ChevronRight, Star } from "lucide-react";
import useSWR from "swr";
import { TransportBadge } from "~/app/components/transport-badge";
import { useI18n } from "~/i18n/i18n-provider";
import type { Connection } from "~/journey/models";
import type { SavedJourney } from "~/journey/search-store";
import { formatDuration, stopName } from "~/lib/format";
import { cn } from "~/lib/utils";
import { expected, formatTime } from "~/timer/journey";
import { fetcher } from "~/utils/fetcher";
import { connectionEnd, connectionStart } from "./connection-card";

// The journeys saved, with their next connection: a tap searches it.
// `current`: the journey searched, marked.
export function FavoriteJourneys({
  journeys,
  current,
  onChoose,
}: {
  journeys: ReadonlyArray<SavedJourney>;
  current?: SavedJourney;
  onChoose: (journey: SavedJourney) => void;
}) {
  const { m } = useI18n();
  return (
    <section className="px-4 pt-1">
      <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Star className="size-3.5 fill-favorite text-favorite" />
        {m.journey.favorites}
      </h2>
      <ul role="list" className="space-y-2">
        {journeys.map((journey) => (
          <JourneyCard
            key={`${journey.from.id}-${journey.to.id}`}
            journey={journey}
            current={
              current !== undefined &&
              current.from.id === journey.from.id &&
              current.to.id === journey.to.id
            }
            onChoose={() => onChoose(journey)}
          />
        ))}
      </ul>
    </section>
  );
}

function JourneyCard({
  journey,
  current,
  onChoose,
}: {
  journey: SavedJourney;
  current: boolean;
  onChoose: () => void;
}) {
  const { m } = useI18n();
  const { from, to } = journey;
  // Same request (and SWR cache) as the search from now
  const { data, error } = useSWR<ReadonlyArray<Connection>>(
    `/api/journey/connections?from=${from.id}&to=${to.id}`,
    fetcher,
    { refreshInterval: 60_000 }
  );
  const next = data?.[0];

  return (
    <li>
      <button
        type="button"
        aria-pressed={current}
        onClick={onChoose}
        title={`${from.name} → ${to.name}`}
        className={cn(
          "flex w-full items-stretch overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-colors hover:bg-muted/60 active:bg-muted",
          current ? "border-primary ring-2 ring-primary/20" : "border-border"
        )}>
        {/* The star on its own column: a favourite, apart from the connections below */}
        <span className="grid w-14 shrink-0 place-items-center border-r border-border bg-favorite/10">
          <Star className="size-5 fill-favorite text-favorite" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5 py-3 pl-3">
          <p className="truncate font-semibold">
            {stopName(from.name)} → {stopName(to.name)}
          </p>
          {next ? (
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="flex shrink-0 items-center gap-1">
                {next.legs.map((leg, index) => (
                  <TransportBadge
                    key={`${leg.trip}-${index}`}
                    line={leg.line}
                    category={leg.category}
                    operator={leg.operator}
                    size={22}
                  />
                ))}
              </span>
              <span className="truncate">
                <span className="font-mono font-bold tabular-nums text-foreground">
                  {formatTime(expected(next.legs[0].departure))} →{" "}
                  {formatTime(expected(next.legs[next.legs.length - 1].arrival))}
                </span>{" "}
                · {formatDuration(connectionEnd(next) - connectionStart(next))}
              </span>
            </div>
          ) : (
            <p className="truncate text-sm text-muted-foreground">
              {error
                ? m.stops.unavailable
                : data
                  ? m.journey.noConnections
                  : m.common.loading}
            </p>
          )}
        </div>
        <ChevronRight className="mx-3 size-4 shrink-0 self-center text-muted-foreground/60" />
      </button>
    </li>
  );
}
