"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useI18n } from "~/i18n/i18n-provider";
import { journeySearchStore } from "~/journey/search-store";
import { stopName } from "~/lib/format";

// The journeys saved on the journey page, one row whatever their number: a
// tap searches the journey there. Nothing until the local storage is read.
export function JourneyChips() {
  const { m } = useI18n();
  const journeys = journeySearchStore.useValue()?.favorites ?? [];
  if (journeys.length === 0) return null;

  return (
    <section className="pt-3">
      <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {m.stops.favoriteJourneys}
      </h2>
      <ul className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {journeys.map(({ from, to }) => (
          <li key={`${from.id}-${to.id}`} className="shrink-0">
            <Link
              href="/tragitto"
              title={`${from.name} → ${to.name}`}
              onClick={() => journeySearchStore.set((s) => ({ ...s, from, to }))}
              className="inline-flex h-8 max-w-[16rem] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
              <Star className="size-3.5 shrink-0 fill-favorite text-favorite" />
              <span className="truncate">
                {stopName(from.name)} → {stopName(to.name)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
