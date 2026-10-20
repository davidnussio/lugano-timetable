"use client";

import { ChevronRight, Star } from "lucide-react";
import useSWR from "swr";
import { TransportBadge } from "~/app/components/transport-badge";
import { useI18n } from "~/i18n/i18n-provider";
import type { Connection } from "~/journey/models";
import type { SavedJourney } from "~/journey/search-store";
import { formatDuration, stopName } from "~/lib/format";
import { expected, formatTime } from "~/timer/journey";
import { fetcher } from "~/utils/fetcher";
import { connectionEnd, connectionStart } from "./connection-card";

// The journeys saved, with their next connection: a tap searches it
export function FavoriteJourneys({
  journeys,
  onChoose,
}: {
  journeys: ReadonlyArray<SavedJourney>;
  onChoose: (journey: SavedJourney) => void;
}) {
  const { m } = useI18n();
  return (
    <section className="px-4 pt-1">
      <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Star className="size-3.5" />
        {m.journey.favorites}
      </h2>
      <ul role="list" className="space-y-2">
        {journeys.map((journey) => (
          <JourneyCard
            key={`${journey.from.id}-${journey.to.id}`}
            journey={journey}
            onChoose={() => onChoose(journey)}
          />
        ))}
      </ul>
    </section>
  );
}

function JourneyCard({ journey, onChoose }: { journey: SavedJourney; onChoose: () => void }) {
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
        onClick={onChoose}
        title={`${from.name} → ${to.name}`}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/60 active:bg-muted">
        <Star className="size-4 shrink-0 fill-favorite text-favorite" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">
            {stopName(from.name)} → {stopName(to.name)}
          </p>
          {next ? (
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="flex shrink-0 items-center gap-1">
                {next.legs.map((leg, index) => (
                  <TransportBadge
                    key={`${leg.trip}-${index}`}
                    line={leg.line}
                    category={leg.category}
                    operator={leg.operator}
                    size={20}
                  />
                ))}
              </span>
              <span className="truncate">
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {formatTime(expected(next.legs[0].departure))} →{" "}
                  {formatTime(expected(next.legs[next.legs.length - 1].arrival))}
                </span>{" "}
                · {formatDuration(connectionEnd(next) - connectionStart(next))}
              </span>
            </div>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {error
                ? m.stops.unavailable
                : data
                  ? m.journey.noConnections
                  : m.common.loading}
            </p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
      </button>
    </li>
  );
}
