"use client";

import useSWR from "swr";
import type { Monitored } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

const empty: ReadonlyArray<never> = [];

// Kept out of the hook: SWR restarts the polling whenever the interval
// changes, and pages ticking every second would never reach the next poll
const refreshInterval = (latest: Monitored<unknown> | undefined) =>
  latest?.ready ? 10_000 : 1_000;
// Once ready, never again: for data that does not change while shown
const untilReady = (latest: Monitored<unknown> | undefined) =>
  latest?.ready ? 0 : 1_000;

// Fetches a monitored resource (itineraries, routing) polling quickly until
// the RTPI session is ready, then every 10 seconds (or no more with `once`).
// Nothing is fetched while `values` is null.
export function useMonitored<A>(
  path: string,
  name: string,
  values: ReadonlyArray<string> | null,
  { once = false }: { readonly once?: boolean } = {}
) {
  const query =
    values && new URLSearchParams(values.map((value) => [name, value]));
  const { data, error } = useSWR<Monitored<A>>(query && `${path}?${query}`, fetcher, {
    refreshInterval: once ? untilReady : refreshInterval,
    ...(once && { revalidateOnFocus: false }),
  });

  return {
    data: data?.data ?? empty,
    ready: data?.ready === true,
    isLoading: !data?.ready,
    isError: error !== undefined,
  };
}
