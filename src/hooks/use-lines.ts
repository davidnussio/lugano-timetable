"use client";

import useSWR from "swr";
import type { Line } from "~/timetable/lines";
import { fetcher } from "~/utils/fetcher";

// The lines of TPL, cached by SWR for the whole session
export function useLines() {
  const { data, error } = useSWR<ReadonlyArray<Line>>("/api/timetable/lines", fetcher, {
    revalidateOnFocus: false,
  });
  return { lines: data, isError: error !== undefined };
}
