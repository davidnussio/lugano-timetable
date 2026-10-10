"use client";

import useSWR from "swr";
import type { Monitored } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

// Fetches a monitored resource (itineraries, routing) polling quickly until
// the RTPI session is ready, then every 10 seconds.
export function useMonitored<A>(
  path: string,
  name: string,
  values: ReadonlyArray<string>
) {
  const query = new URLSearchParams(values.map((value) => [name, value]));
  const { data, error } = useSWR<Monitored<A>>(`${path}?${query}`, fetcher, {
    refreshInterval: (latest) => (latest?.ready ? 10_000 : 1_000),
  });

  return {
    data: data?.data ?? [],
    isLoading: !data?.ready,
    isError: error !== undefined,
  };
}
