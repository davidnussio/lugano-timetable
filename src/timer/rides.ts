"use client";

import { createLocalStore } from "~/lib/local-store";
import type { Departure } from "~/timetable/models";
import type { ActiveTimer } from "./store";
import { isStoredRides } from "./valid";

// A line in one direction from a stop of the user, shown on the home with
// its next departures
export interface FavoriteRide {
  // All the platforms of the stop, as on the stop page (shares its polling)
  readonly stop: ActiveTimer["stop"];
  readonly route: string;
  readonly line: string;
  readonly img: string;
  readonly dir: string;
  readonly destination: string;
  // Timers started on the ride by hour of the day, to put first the rides
  // taken around this time
  readonly hours: ReadonlyArray<number>;
}

export const ridesStore = createLocalStore<ReadonlyArray<FavoriteRide>>(
  "lugano-timetable-rides",
  [],
  isStoredRides
);

// Whether the hint on how to add a ride was closed
export const ridesHintStore = createLocalStore<boolean>(
  "lugano-timetable-rides-hint",
  false,
  (value): value is boolean => typeof value === "boolean"
);

// The departures of a stop matching a ride are found by line and direction
export interface RideKey {
  readonly identifiers: ReadonlyArray<string>;
  readonly route: string;
  readonly dir: string;
}

export function sameRide(ride: FavoriteRide, key: RideKey): boolean {
  return (
    ride.route === key.route &&
    ride.dir === key.dir &&
    ride.stop.identifiers.join(",") === key.identifiers.join(",")
  );
}

export function createRide(departure: Departure, stop: ActiveTimer["stop"]): FavoriteRide {
  return {
    stop,
    route: departure.Route,
    line: departure.RouteCode,
    img: departure.Img,
    dir: departure.Dir,
    destination: departure.Dest,
    hours: Array.from({ length: 24 }, () => 0),
  };
}

// Adds the ride last, or removes it when already there
export function toggleRide(
  rides: ReadonlyArray<FavoriteRide>,
  ride: FavoriteRide
): ReadonlyArray<FavoriteRide> {
  const key = { identifiers: ride.stop.identifiers, route: ride.route, dir: ride.dir };
  return rides.some((r) => sameRide(r, key))
    ? rides.filter((r) => !sameRide(r, key))
    : [...rides, ride];
}

// Past this count in one hour the whole histogram is halved: the habits of
// the latest months weigh more than the old ones
const MAX_COUNT = 20;

// Counts a timer started at `hour` on the ride, the same array when the ride
// is not a favorite
export function recordStart(
  rides: ReadonlyArray<FavoriteRide>,
  key: RideKey,
  hour: number
): ReadonlyArray<FavoriteRide> {
  let changed = false;
  const next = rides.map((ride) => {
    if (!sameRide(ride, key)) return ride;
    changed = true;
    const hours = ride.hours.map((count, h) => (h === hour ? count + 1 : count));
    return {
      ...ride,
      hours: hours[hour] > MAX_COUNT ? hours.map((count) => Math.floor(count / 2)) : hours,
    };
  });
  return changed ? next : rides;
}

// Timers started at this hour count double, the ones of the hour before and
// after once: a bus taken at 7:50 is also the one of 8:05
export function hourScore(hours: ReadonlyArray<number>, hour: number): number {
  const at = (h: number) => hours[(h + 24) % 24] ?? 0;
  return 2 * at(hour) + at(hour - 1) + at(hour + 1);
}

// The rides taken around this time first, then the nearest (when the
// distance is known), then in the order they were added
export function rankRides(
  rides: ReadonlyArray<FavoriteRide>,
  hour: number,
  distanceOf: (ride: FavoriteRide) => number | undefined = () => undefined
): ReadonlyArray<FavoriteRide> {
  return rides
    .map((ride, index) => ({
      ride,
      index,
      score: hourScore(ride.hours, hour),
      distance: distanceOf(ride) ?? Infinity,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Infinity - Infinity is NaN: falls through to the order
        a.distance - b.distance ||
        a.index - b.index
    )
    .map(({ ride }) => ride);
}

// The departures of the ride in the real-time list of its stop, soonest
// first; the ones without a real-time wait by clock time
export function rideDepartures(
  departures: ReadonlyArray<Departure>,
  ride: FavoriteRide
): ReadonlyArray<Departure> {
  return departures
    .filter((d) => d.Route === ride.route && d.Dir === ride.dir)
    .sort((a, b) =>
      a.DepartureAt !== undefined && b.DepartureAt !== undefined
        ? a.DepartureAt - b.DepartureAt
        : a.Time.localeCompare(b.Time)
    );
}
