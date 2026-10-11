"use client";

import { createLocalStore } from "~/lib/local-store";
import type { Station } from "./models";

export interface JourneySearch {
  readonly from?: Station;
  readonly to?: Station;
  // Latest journeys started, most recent first
  readonly recent: ReadonlyArray<{ readonly from: Station; readonly to: Station }>;
}

const RECENT = 5;

export const journeySearchStore = createLocalStore<JourneySearch>(
  "lugano-timetable-journey-search",
  { recent: [] }
);

const sameJourney =
  (from: Station, to: Station) =>
  (journey: { readonly from: Station; readonly to: Station }) =>
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
