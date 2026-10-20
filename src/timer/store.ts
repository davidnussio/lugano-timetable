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
import {
  type AlertMessage,
  type Approach,
  alertThresholds,
  type Pace,
  type WalkSource,
} from "./plan";
import type { GetOff } from "./get-off";
import { type LearnedPace, NO_PACE, type WalkTrack } from "./pace";
import type { AtStop } from "./progress";
import { isLearnedPace, isStoredTimer } from "./valid";

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
  // Whether the thresholds were planned knowing the walking time, and
  // measured with the GPS rather than taken from the timetable
  readonly plannedWithWalk: boolean;
  readonly plannedWithGps?: boolean;
  // Latest alert, shown in the app until dismissed
  readonly lastAlert?: AlertMessage & { readonly at: number };
  readonly journey?: ActiveJourney;
  // How far the user is on the way to the stop, followed with the GPS
  readonly approach?: Approach;
  // The walk to the stop, measured to learn the pace of the user
  readonly walk?: WalkTrack;
  // When the user reached the stop, with the walk there: the trip so far
  readonly atStop?: AtStop;
  // Where the user gets off a single bus: the timer then follows the ride
  readonly getOff?: GetOff;
}

export interface TimerSettings {
  // Unset until the user flips the switch: on when the location permission
  // has already been granted
  readonly useLocation?: boolean;
  readonly pace: Pace;
}

export const timerStore = createLocalStore<ActiveTimer | null>(
  "lugano-timetable-timer",
  null,
  isStoredTimer
);

export const settingsStore = createLocalStore<TimerSettings>(
  "lugano-timetable-timer-settings",
  { pace: "normal" }
);

// Kept apart from the settings: measured, not chosen
export const paceStore = createLocalStore<LearnedPace>(
  "lugano-timetable-pace",
  NO_PACE,
  isLearnedPace
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

// Without a trip id, a bus counts as the one of the timer only this close to
// its last known time: farther away it is another run of the line
const FOLLOW_TOLERANCE_MS = 10 * 60_000;

// The bus of the timer in the real-time list: by trip id, or the departure
// of the same line closest to the last known time. Once the bus has left
// (`departed`) it drops out of the list: a later run is the next bus.
export function findTimerDeparture(
  timer: ActiveTimer,
  departures: ReadonlyArray<Departure>,
  departed: boolean
): ScheduledDeparture | undefined {
  // A planned bus not found yet: by line and time
  if (timer.routing === "" && timer.uid === undefined) {
    const planned = timer.journey?.legs[0].departure;
    return findLegDeparture(departures, timer.line, {
      scheduled: planned?.scheduled ?? timer.departureAt,
      estimated: timer.departureAt,
    });
  }
  const scheduled = departures.filter(isScheduled);
  if (timer.uid !== undefined) {
    return scheduled.find((departure) => departure.Uid === timer.uid);
  }
  let best: ScheduledDeparture | undefined;
  for (const departure of scheduled) {
    const offset = Math.abs(departure.DepartureAt - timer.departureAt);
    if (
      departure.Target !== timer.target ||
      departure.Routing !== timer.routing ||
      offset > FOLLOW_TOLERANCE_MS ||
      (departed && departure.DepartureAt > timer.departureAt)
    ) {
      continue;
    }
    if (best === undefined || offset < Math.abs(best.DepartureAt - timer.departureAt)) {
      best = departure;
    }
  }
  return best;
}

// Later runs of a line are minutes apart: closer, it is the bus of the timer
// itself with a newer time
const NEXT_RUN_GAP_MS = 60_000;

// The bus to take once the one of the timer is missed: the first later run of
// the same line in the same direction that can still be caught at `earliest`
// (now, plus the walk when known). From any platform of the stop and on any
// variant of the line: the destination shown tells a shorter run apart.
export function nextTimerDeparture(
  timer: ActiveTimer,
  departures: ReadonlyArray<Departure>,
  earliest: number
): ScheduledDeparture | undefined {
  // A journey looks for its later plans itself
  if (timer.journey !== undefined) return undefined;
  let best: ScheduledDeparture | undefined;
  for (const departure of departures) {
    if (
      !isScheduled(departure) ||
      departure.Route !== timer.route ||
      departure.Dir !== timer.dir ||
      (timer.uid !== undefined && departure.Uid === timer.uid) ||
      departure.DepartureAt < timer.departureAt + NEXT_RUN_GAP_MS ||
      departure.DepartureAt < earliest
    ) {
      continue;
    }
    if (best === undefined || departure.DepartureAt < best.DepartureAt) {
      best = departure;
    }
  }
  return best;
}

// The thresholds planned again once the walk is better known, until the
// first alert: on the walk of the timetable, then on the one of the GPS
export function planAlerts(
  timer: ActiveTimer,
  walk: WalkSource | undefined,
  leaveMs: number
): ActiveTimer {
  if (
    walk === undefined ||
    timer.fired.length > 0 ||
    timer.plannedWithGps === true ||
    (walk === "timetable" && timer.plannedWithWalk)
  ) {
    return timer;
  }
  return {
    ...timer,
    thresholds: alertThresholds(leaveMs / 60_000),
    plannedWithWalk: true,
    plannedWithGps: walk === "gps",
  };
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

// The timer of a single bus on this trip of the line page: the stop to get
// off can be chosen there
export function followsTrip(
  timer: ActiveTimer,
  trip: {
    readonly target: string;
    readonly route: string;
    readonly dir: string;
    readonly routing: string;
  }
): boolean {
  return (
    timer.journey === undefined &&
    timer.target === trip.target &&
    timer.route === trip.route &&
    timer.dir === trip.dir &&
    timer.routing === trip.routing
  );
}

// When the timer is over: the departure, the arrival at the stop to get off,
// or the arrival of a journey after the walk to its destination
export function timerEndsAt(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined = timer.journey?.legs,
  walkAfterMs = timer.journey?.walkAfterMs
): number {
  const { getOff } = timer;
  if (getOff !== undefined && timer.journey === undefined) {
    return getOff.arrivedAt ?? Math.max(timer.departureAt, getOff.arrivalAt ?? 0);
  }
  const last = legs?.at(-1);
  return last === undefined
    ? timer.departureAt
    : expected(last.arrival) + (walkAfterMs ?? 0);
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
