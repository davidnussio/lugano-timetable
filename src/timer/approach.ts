// Where the bus of the timer is on its way to the stop of the user, for the
// track over the countdown: the stop of the user and the few before it.
// Like `plan.ts`, kept free of browser APIs.

import { busPosition } from "~/lib/trip";
import type { RoutingStatus } from "~/timetable/models";
import { clockAt } from "./get-off";

// Stops shown before the one of the user: further away the bus is just far
export const APPROACH_STOPS = 2;

// The routing may show the run before (or after) the one of the timer: its
// time at the stop of the user tells
const SAME_RUN_MS = 3 * 60_000;

interface ApproachStop {
  readonly UID: string;
  readonly Name: string;
  readonly Time: string;
  readonly Status: RoutingStatus;
}

export interface Approach<S extends ApproachStop = ApproachStop> {
  // The stops before the one of the user, at most `APPROACH_STOPS`, then
  // that of the user
  readonly stops: ReadonlyArray<S>;
  // Stops still to reach the one of the user: 0 there, 1.5 between the
  // second and the first before. Undefined when the routing shows another
  // run, the one of the timer being still far.
  readonly away: number | undefined;
}

// Undefined when the routing does not show the stop of the user, or once
// the bus of the timer has left it
export function approach<S extends ApproachStop>(
  stops: ReadonlyArray<S>,
  mine: string,
  departureAt: number,
  now: number
): Approach<S> | undefined {
  const index = stops.findIndex((stop) => stop.UID === mine);
  if (index <= 0) return undefined;
  const shown = stops.slice(Math.max(0, index - APPROACH_STOPS), index + 1);
  const at = clockAt(stops[index].Time, now);
  if (at === undefined || Math.abs(at - departureAt) > SAME_RUN_MS) {
    return { stops: shown, away: undefined };
  }
  const position = busPosition(stops);
  const away =
    position.kind === "origin"
      ? index
      : position.kind === "at"
        ? index - position.index
        : position.kind === "between"
          ? index - position.from - 0.5
          : -1;
  return away < 0 ? undefined : { stops: shown, away };
}
