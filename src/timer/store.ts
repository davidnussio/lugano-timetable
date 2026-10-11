"use client";

import type { Connection, LegUpdate, PlannedLeg, Station } from "~/journey/models";
import { closestPlatform, findLegDeparture, isTplLeg } from "~/journey/tpl";
import { createLocalStore } from "~/lib/local-store";
import type { Coordinates, Departure, Target } from "~/timetable/models";
import {
  type ConnectionStatus,
  expected,
  formatTime,
  type Timing,
  type Transfer,
} from "./journey";
import { type AlertMessage, alertThresholds, type Pace } from "./plan";

// A journey with transfers planned with transport.opendata.ch. The timer
// counts down to its first leg.
export interface ActiveJourney {
  readonly from: Station;
  readonly to: Station;
  // With the latest timings
  readonly legs: ReadonlyArray<PlannedLeg>;
  readonly walkAfterMs?: number;
  // Transfer alerts already shown, as "<transfer>:<status>"
  readonly alerted: ReadonlyArray<string>;
}

// The departure the user wants to catch
export interface ActiveTimer {
  readonly stop: {
    readonly name: string;
    readonly label: string;
    // All the platforms of the stop, as on the stop page (shares its polling)
    readonly identifiers: ReadonlyArray<string>;
  };
  // Platform the bus leaves from, with its position when known
  // Empty until the bus of a journey is found in the real-time data
  readonly target: string;
  readonly coordinates?: { readonly lat: number; readonly lon: number };
  readonly line: string;
  readonly route: string;
  readonly dir: string;
  readonly routing: string;
  readonly img: string;
  readonly destination: string;
  readonly uid?: number;
  readonly time: string;
  // Latest known departure, updated with the real-time data
  readonly departureAt: number;
  readonly startedAt: number;
  // Remaining minutes at which to alert, and the ones already shown
  readonly thresholds: ReadonlyArray<number>;
  readonly fired: ReadonlyArray<number>;
  // Whether the thresholds were planned knowing the walking time
  readonly plannedWithWalk: boolean;
  // Latest alert, shown in the app until dismissed
  readonly lastAlert?: AlertMessage & { readonly at: number };
  readonly journey?: ActiveJourney;
}

export interface TimerSettings {
  // Unset until the user flips the switch: on when the location permission
  // has already been granted
  readonly useLocation?: boolean;
  readonly pace: Pace;
}

export const timerStore = createLocalStore<ActiveTimer | null>(
  "lugano-timetable-timer",
  null
);

export const settingsStore = createLocalStore<TimerSettings>(
  "lugano-timetable-timer-settings",
  { pace: "normal" }
);

export type ScheduledDeparture = Departure & { readonly DepartureAt: number };

export function isScheduled(
  departure: Departure
): departure is ScheduledDeparture {
  return departure.DepartureAt !== undefined;
}

export function createTimer(
  departure: ScheduledDeparture,
  stop: ActiveTimer["stop"],
  coordinates: Coordinates | undefined,
  now: number
): ActiveTimer {
  return {
    stop,
    target: departure.Target,
    coordinates: coordinates && { lat: coordinates.Lat, lon: coordinates.Lon },
    line: departure.RouteCode,
    route: departure.Route,
    dir: departure.Dir,
    routing: departure.Routing,
    img: departure.Img,
    destination: departure.Dest,
    uid: departure.Uid,
    time: departure.Time,
    departureAt: departure.DepartureAt,
    startedAt: now,
    thresholds: alertThresholds((departure.DepartureAt - now) / 60_000),
    fired: [],
    plannedWithWalk: false,
  };
}

// The timer of a planned journey. A first leg on a TPL bus is followed with
// the real-time data of its stop, the others with the timetable forecasts.
export function createJourneyTimer(
  connection: Connection,
  from: Station,
  to: Station,
  targets: ReadonlyArray<Target> | undefined,
  now: number
): ActiveTimer {
  const [first] = connection.legs;
  const stop = isTplLeg(first)
    ? targets?.find((target) => target.CodeNat === first.from.id)
    : undefined;
  const platform = stop && closestPlatform(stop, first.from.position);
  const departureAt = expected(first.departure);
  return {
    stop: {
      name: stop?.Name ?? first.from.name,
      label: stop?.Label ?? first.from.name,
      identifiers: stop?.Identifiers ?? [],
    },
    target: "",
    coordinates: platform
      ? { lat: platform.Lat, lon: platform.Lon }
      : first.from.position,
    line: first.line,
    route: "",
    dir: "",
    routing: "",
    img: "",
    destination: first.destination,
    time: formatTime(departureAt),
    departureAt,
    startedAt: now,
    thresholds: alertThresholds((departureAt - now) / 60_000),
    fired: [],
    plannedWithWalk: false,
    journey: {
      from,
      to,
      legs: connection.legs,
      ...(connection.walkAfterMs === undefined
        ? {}
        : { walkAfterMs: connection.walkAfterMs }),
      alerted: [],
    },
  };
}

// The bus of the timer in the real-time list: by trip id, or the departure
// of the same line closest to the last known time.
export function findTimerDeparture(
  timer: ActiveTimer,
  departures: ReadonlyArray<Departure>
): ScheduledDeparture | undefined {
  // A planned bus not found yet: by line and time
  if (timer.routing === "" && timer.uid === undefined) {
    return findLegDeparture(departures, timer.line, timer.departureAt);
  }
  let best: ScheduledDeparture | undefined;
  for (const departure of departures) {
    if (!isScheduled(departure)) continue;
    if (timer.uid !== undefined && departure.Uid !== undefined) {
      if (departure.Uid === timer.uid) return departure;
    } else if (
      departure.Target === timer.target &&
      departure.Routing === timer.routing &&
      (best === undefined ||
        Math.abs(departure.DepartureAt - timer.departureAt) <
          Math.abs(best.DepartureAt - timer.departureAt))
    ) {
      best = departure;
    }
  }
  return best;
}

// Query of /api/journey/legs: stable while the journey runs
export function legsQuery(legs: ReadonlyArray<PlannedLeg>): string {
  return new URLSearchParams(
    legs.map((leg) => [
      "leg",
      `${leg.from.id},${leg.trip},${leg.departure.scheduled},${leg.to.id}`,
    ])
  ).toString();
}

const sameTiming = (a: Timing, b: Timing) =>
  a.scheduled === b.scheduled && a.estimated === b.estimated;

// The legs with the latest timings, the same array when nothing changed.
// Legs not found keep their last timings.
export function applyLegUpdates(
  legs: ReadonlyArray<PlannedLeg>,
  updates: ReadonlyArray<LegUpdate>
): ReadonlyArray<PlannedLeg> {
  let changed = false;
  const next = legs.map((leg, index) => {
    const update = updates[index];
    if (
      !update ||
      (sameTiming(leg.departure, update.departure) &&
        sameTiming(leg.arrival, update.arrival))
    ) {
      return leg;
    }
    changed = true;
    return { ...leg, departure: update.departure, arrival: update.arrival };
  });
  return changed ? next : legs;
}

// The legs of the journey with the first departure of the real-time data,
// fresher than the timetable while the bus has not left: its arrival moves
// by as much.
export function liveLegs(
  timer: ActiveTimer,
  now: number
): ReadonlyArray<PlannedLeg> | undefined {
  const legs = timer.journey?.legs;
  if (legs === undefined) return undefined;
  const followed = timer.routing !== "" || timer.uid !== undefined;
  if (!followed || timer.departureAt < now) return legs;
  const [first, ...rest] = legs;
  const shift = timer.departureAt - expected(first.departure);
  if (shift === 0) return legs;
  return [
    {
      ...first,
      departure: { ...first.departure, estimated: timer.departureAt },
      arrival: {
        ...first.arrival,
        estimated: expected(first.arrival) + shift,
      },
    },
    ...rest,
  ];
}

// When the timer is over: the departure, or the arrival of a journey
export function timerEndsAt(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined = timer.journey?.legs
): number {
  const last = legs?.at(-1);
  return last === undefined
    ? timer.departureAt
    : expected(last.arrival) + (timer.journey?.walkAfterMs ?? 0);
}

export interface TransferAlert {
  readonly index: number;
  readonly status: Exclude<ConnectionStatus, "ok">;
  readonly key: string;
}

// The next transfer whose connection got worse since the last alert. Only
// transfers still to come: once the bus has arrived, it is too late.
export function dueTransferAlert(
  transfers: ReadonlyArray<Transfer>,
  legs: ReadonlyArray<PlannedLeg>,
  alerted: ReadonlyArray<string>,
  now: number
): TransferAlert | undefined {
  for (const [index, { status }] of transfers.entries()) {
    if (expected(legs[index].arrival) < now) continue;
    if (status === "ok") continue;
    const key = `${index}:${status}`;
    if (!alerted.includes(key)) return { index, status, key };
  }
  return undefined;
}
