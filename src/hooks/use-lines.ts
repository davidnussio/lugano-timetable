"use client";

import useSWR from "swr";
import type { Line } from "~/timetable/lines";
import { fetcher } from "~/utils/fetcher";

// The lines of TPL. While the server is still learning them, asked again
// every half a minute.
export function useLines() {
  const { data, error } = useSWR<ReadonlyArray<Line>>("/api/timetable/lines", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latest) => (latest !== undefined && latest.length === 0 ? 30_000 : 0),
  });
  return { lines: data, isError: error !== undefined };
}
