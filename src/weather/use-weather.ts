"use client";

import useSWR from "swr";
import { fetcher } from "~/utils/fetcher";
import type { CurrentWeather } from "./open-meteo-client";

interface Point {
  readonly lat: number;
  readonly lon: number;
}

// About 5 km: the rain is the same over the town, and the users nearby
// share the copy of the CDN
const WEATHER_GRID = 0.05;

// The models are updated every 15 minutes, the CDN keeps them for 10
const REFRESH_MS = 10 * 60_000;

const snap = (value: number) => (Math.round(value / WEATHER_GRID) * WEATHER_GRID).toFixed(2);

export const weatherKey = ({ lat, lon }: Point) =>
  `/api/weather?lat=${snap(lat)}&lon=${snap(lon)}`;

// The weather now at `position`, asked only while it is given. Undefined
// while unknown or when Open-Meteo is unavailable: the walk is then as dry.
export function useWeather(position: Point | undefined): CurrentWeather | undefined {
  const { data, error } = useSWR<CurrentWeather>(
    position ? weatherKey(position) : null,
    fetcher,
    {
      refreshInterval: REFRESH_MS,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      // Across the edge of a cell of the grid, keep the weather until the
      // next one comes
      keepPreviousData: true,
    }
  );
  // The previous weather is kept also when no longer asked
  return position && !error ? data : undefined;
}
