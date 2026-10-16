"use client";

import useSWR from "swr";
import { fetcher } from "~/utils/fetcher";

interface Point {
  readonly lat: number;
  readonly lon: number;
}

// About 20 m: the height of the user is asked again every few steps, and the
// same points of a street come back from the cache
const USER_GRID = 0.0002;

const heightKey = (lat: number, lon: number) =>
  `/api/height?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`;

const snap = (value: number) => Math.round(value / USER_GRID) * USER_GRID;

const options = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
  // Outside of Switzerland there is no height: walk as on the flat
  shouldRetryOnError: false,
};

// Meters to go up from the user to the stop (negative downhill), from the
// terrain model of swisstopo. Undefined until both heights are known.
export function useClimb(user: Point | undefined, stop: Point | undefined): number | undefined {
  const { data: stopHeight } = useSWR<{ height: number }>(
    user && stop ? heightKey(stop.lat, stop.lon) : null,
    fetcher,
    options
  );
  const { data: userHeight } = useSWR<{ height: number }>(
    user && stop ? heightKey(snap(user.lat), snap(user.lon)) : null,
    fetcher,
    // While walking, keep the last height until the next one comes
    { ...options, keepPreviousData: true }
  );
  // The previous height is kept also when no longer asked
  if (!user || !stop || stopHeight === undefined || userHeight === undefined) {
    return undefined;
  }
  return stopHeight.height - userHeight.height;
}
