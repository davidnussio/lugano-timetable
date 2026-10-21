"use client";

import { ChevronRight, Star } from "lucide-react";
import { useI18n } from "~/i18n/i18n-provider";
import type { SavedJourney } from "~/journey/search-store";
import { journeyTowns, stopName } from "~/lib/format";
import { cn } from "~/lib/utils";

// The journeys saved, as the favorite stops: a tap searches it.
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
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {m.journey.favorites}
      </h2>
      <ul
        role="list"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {journeys.map((journey) => (
          <JourneyRow
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

function JourneyRow({
  journey,
  current,
  onChoose,
}: {
  journey: SavedJourney;
  current: boolean;
  onChoose: () => void;
}) {
  const { from, to } = journey;
  const towns = journeyTowns(from.name, to.name);
  const townCell = "truncate text-xs text-muted-foreground";
  return (
    <li>
      <button
        type="button"
        aria-pressed={current}
        onClick={onChoose}
        title={`${from.name} → ${to.name}`}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted",
          // The corners of the card on the first and last rows
          "[li:first-child_&]:rounded-t-2xl [li:last-child_&]:rounded-b-2xl",
          current && "ring-2 ring-inset ring-primary"
        )}>
        <Star className="size-4 shrink-0 fill-favorite text-favorite" />
        {/* Each town under its stop */}
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,max-content)_auto_minmax(0,1fr)] gap-x-1.5">
          <span className="truncate font-medium">{stopName(from.name)}</span>
          <span className="font-medium">→</span>
          <span className="truncate font-medium">{stopName(to.name)}</span>
          {(towns.from || towns.to) && (
            <>
              <span className={townCell}>{towns.from}</span>
              <span />
              <span className={townCell}>{towns.to}</span>
            </>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
      </button>
    </li>
  );
}
