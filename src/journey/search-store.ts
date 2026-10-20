"use client";

import { createLocalStore } from "~/lib/local-store";
import type { Station } from "./models";

export interface JourneySearch {
  readonly from?: Station;
  readonly to?: Station;
  // Latest journeys started, most recent first
  readonly recent: ReadonlyArray<SavedJourney>;
  // Journeys saved by the user, in the order they were saved: absent from
  // the searches of before
  readonly favorites?: ReadonlyArray<SavedJourney>;
}

export interface SavedJourney {
  readonly from: Station;
  readonly to: Station;
}

const RECENT = 5;
const FAVORITES = 10;

export const journeySearchStore = createLocalStore<JourneySearch>(
  "lugano-timetable-journey-search",
  { recent: [] }
);

const sameJourney =
  (from: Station, to: Station) =>
  (journey: SavedJourney) =>
    journey.from.id === from.id && journey.to.id === to.id;

// Puts a journey first among the recent ones
export function rememberJourney(
  search: JourneySearch,
  from: Station,
  to: Station
): JourneySearch {
  const others = search.recent.filter((journey) => !sameJourney(from, to)(journey));
  return { ...search, recent: [{ from, to }, ...others].slice(0, RECENT) };
}

export function isFavoriteJourney(search: JourneySearch, from: Station, to: Station): boolean {
  return (search.favorites ?? []).some(sameJourney(from, to));
}

// Saves a journey among the favorite ones, or forgets it. Each way is a
// journey of its own.
export function toggleFavoriteJourney(
  search: JourneySearch,
  from: Station,
  to: Station
): JourneySearch {
  const favorites = search.favorites ?? [];
  return {
    ...search,
    favorites: isFavoriteJourney(search, from, to)
      ? favorites.filter((journey) => !sameJourney(from, to)(journey))
      : [...favorites, { from, to }].slice(-FAVORITES),
  };
}
