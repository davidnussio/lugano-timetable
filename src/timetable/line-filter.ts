"use client";

import { createLocalStore } from "~/lib/local-store";
import type { Departure } from "./models";

// A line of the stop page filter. Lines are chosen as a whole, in both
// directions: the destination is on each row, and a filter by destination
// would silently drop the runs that end earlier than usual.
export interface FilterLine {
  // RTPI route id, stable across the day (`RouteCode` is the name shown)
  readonly route: string;
  readonly line: string;
  readonly img: string;
}

export interface LineChip extends FilterLine {
  readonly selected: boolean;
  // Chosen, but without departures right now
  readonly absent: boolean;
}

// The lines chosen at each stop, by its identifiers as in the URL
export type LineFilters = Readonly<Record<string, ReadonlyArray<FilterLine>>>;

const isFilterLine = (value: unknown): value is FilterLine =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).route === "string" &&
  typeof (value as Record<string, unknown>).line === "string" &&
  typeof (value as Record<string, unknown>).img === "string";

const isLineFilters = (value: unknown): value is LineFilters =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (lines) => Array.isArray(lines) && lines.every(isFilterLine)
  );

export const lineFilterStore = createLocalStore<LineFilters>(
  "lugano-timetable-line-filter",
  {},
  isLineFilters
);

export function stopKey(identifiers: ReadonlyArray<string>): string {
  return identifiers.join(",");
}

// By line name as on the badges: "2" before "10", then the letters
const byLine = (a: FilterLine, b: FilterLine) =>
  a.line.localeCompare(b.line, "it", { numeric: true });

// One chip per line with departures, plus the chosen lines without any,
// so that the filter never hides everything without saying why
export function lineChips(
  departures: ReadonlyArray<Departure>,
  selected: ReadonlyArray<FilterLine>
): ReadonlyArray<LineChip> {
  const chosen = new Set(selected.map((line) => line.route));
  const present = new Map<string, FilterLine>();
  for (const departure of departures) {
    if (!present.has(departure.Route)) {
      present.set(departure.Route, {
        route: departure.Route,
        line: departure.RouteCode,
        img: departure.Img,
      });
    }
  }
  const absent = selected.filter((line) => !present.has(line.route));
  return [...present.values(), ...absent].sort(byLine).map((line) => ({
    ...line,
    selected: chosen.has(line.route),
    absent: !present.has(line.route),
  }));
}

// No line chosen means all of them
export function filterDepartures<A extends Departure>(
  departures: ReadonlyArray<A>,
  selected: ReadonlyArray<FilterLine>
): ReadonlyArray<A> {
  if (selected.length === 0) return departures;
  const chosen = new Set(selected.map((line) => line.route));
  return departures.filter((departure) => chosen.has(departure.Route));
}

export function toggleLine(
  selected: ReadonlyArray<FilterLine>,
  line: FilterLine
): ReadonlyArray<FilterLine> {
  const { route, line: name, img } = line;
  return selected.some((chosen) => chosen.route === route)
    ? selected.filter((chosen) => chosen.route !== route)
    : [...selected, { route, line: name, img }];
}

// The filters with the lines of a stop, without keeping empty entries
export function withLines(
  filters: LineFilters,
  key: string,
  lines: ReadonlyArray<FilterLine>
): LineFilters {
  const { [key]: _previous, ...others } = filters;
  return lines.length === 0 ? others : { ...others, [key]: lines };
}
