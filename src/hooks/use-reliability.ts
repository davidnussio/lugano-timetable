"use client";

import useSWR from "swr";
import type { DelayStats } from "~/timetable/reliability";
import { fetcher } from "~/utils/fetcher";

interface Departure {
  readonly target: string;
  readonly route: string;
  readonly dir: string;
  readonly time: string;
}

// The past days change once a day: no need to ask again while the page is
// open, and without them the page works as before
const options = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
};

// How late the departure left on the past days, from the delays the server
// saw in the real-time data. Nothing is fetched while `departure` is null.
export function useReliability(departure: Departure | null): DelayStats | undefined {
  const query = departure && new URLSearchParams({ ...departure });
  const { data } = useSWR<DelayStats>(
    query && `/api/timetable/reliability?${query}`,
    fetcher,
    options
  );
  return data;
}
