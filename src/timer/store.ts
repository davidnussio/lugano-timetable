"use client";

import { createLocalStore } from "~/lib/local-store";
import type { Coordinates, Departure } from "~/timetable/models";
import { type AlertMessage, alertThresholds, type Pace } from "./plan";

// The departure the user wants to catch
export interface ActiveTimer {
  readonly stop: {
    readonly name: string;
    readonly label: string;
    // All the platforms of the stop, as on the stop page (shares its polling)
    readonly identifiers: ReadonlyArray<string>;
  };
  // Platform the bus leaves from, with its position when known
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

// The bus of the timer in the real-time list: by trip id, or the departure
// of the same line closest to the last known time.
export function findTimerDeparture(
  timer: ActiveTimer,
  departures: ReadonlyArray<Departure>
): ScheduledDeparture | undefined {
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
