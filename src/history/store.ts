"use client";

import { useMemo } from "react";
import { createLocalStore } from "~/lib/local-store";
import { addTrip, type TripRecord } from "./trip";
import { validTrips } from "./valid";

// Any array: the trips are checked one by one, so that a single trip of
// another shape does not throw the whole history away
const store = createLocalStore<ReadonlyArray<unknown>>(
  "lugano-timetable-history",
  [],
  (value): value is ReadonlyArray<unknown> => Array.isArray(value)
);

export const historyStore = {
  get: (): ReadonlyArray<TripRecord> => validTrips(store.get()),
  add: (trip: TripRecord) => store.set((stored) => addTrip(validTrips(stored), trip)),
  // Merges the trips of an export: the ones already there are replaced
  merge: (trips: ReadonlyArray<TripRecord>) =>
    store.set((stored) => trips.reduce(addTrip, validTrips(stored))),
  clear: () => store.set([]),
};

// The trips of the history, oldest first; null on the server and during
// hydration
export function useHistory(): ReadonlyArray<TripRecord> | null {
  const stored = store.useValue();
  return useMemo(() => (stored === null ? null : validTrips(stored)), [stored]);
}
