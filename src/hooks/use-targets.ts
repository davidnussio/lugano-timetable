"use client";

import useSWR from "swr";
import type { Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

// The stop list, cached by SWR for the whole session
export function useTargets() {
  const { data } = useSWR<ReadonlyArray<Target>>(
    "/api/timetable/targets",
    fetcher,
    { revalidateOnFocus: false }
  );
  return data;
}

export function findTarget(
  targets: ReadonlyArray<Target> | undefined,
  identifiers: ReadonlyArray<string>
): Target | undefined {
  const key = identifiers.join(",");
  return targets?.find((target) => target.Identifiers.join(",") === key);
}
