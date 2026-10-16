// Pure logic behind getting off a single bus at the stop chosen by the user:
// where the bus is on the way there, what to tell and when. Like `plan.ts`,
// kept free of browser APIs.

import { busPosition } from "~/lib/trip";
import type { RoutingStatus } from "~/timetable/models";
import type { AlertMessage, Position } from "./plan";
import type { Headline } from "./tone";

export type GetOffAlert = "next" | "now";

// The stop where the user gets off, chosen on the line page
export interface GetOff {
  // Platform in the routing of the ride, with its position when known
  readonly target: string;
  readonly name: string;
  readonly position?: Position;
  // Latest known time of the bus at the stop
  readonly arrivalAt?: number;
  // Whether the bus has been seen leaving the stop of the user: a routing
  // with the bus before it again is another run
  readonly left?: boolean;
  // When the bus was seen at (or past) the stop
  readonly arrivedAt?: number;
  readonly alerted: ReadonlyArray<GetOffAlert>;
}

interface RideStop {
  readonly UID: string;
  readonly Time: string;
  readonly Status: RoutingStatus;
}

export type RideStatus = "before" | "next" | "at" | "passed";

export interface Ride {
  // Whether the bus has left the stop of the user
  readonly left: boolean;
  // Stops still to reach up to the chosen one: 1 once it is the next, 0 at it
  readonly stopsLeft: number;
  // "next": the bus has left the stop before the chosen one
  readonly status: RideStatus;
  // Time of the bus at the chosen stop in the routing
  readonly time: string;
}

// Where the bus is on the way from the stop of the user (`mine`) to the one
// where they get off. Undefined when the routing does not show this ride:
// stops missing, or the next run once the bus has left.
export function rideState(
  stops: ReadonlyArray<RideStop>,
  mine: string,
  getOff: Pick<GetOff, "target" | "left">
): Ride | undefined {
  const from = stops.findIndex((stop) => stop.UID === mine);
  const to = stops.findIndex((stop) => stop.UID === getOff.target);
  if (from === -1 || to <= from) return undefined;
  const position = busPosition(stops);
  // The last stop the bus has reached: it is there or has left it
  const reached =
    position.kind === "at"
      ? position.index
      : position.kind === "between"
        ? position.from
        : position.kind === "arrived"
          ? stops.length - 1
          : 0;
  const at = position.kind === "at";
  const left = reached > from || (reached === from && !at);
  if (getOff.left === true && !left) return undefined;
  const status: RideStatus =
    reached > to || (reached === to && !at)
      ? "passed"
      : reached === to
        ? "at"
        : reached === to - 1 && !at
          ? "next"
          : "before";
  return {
    left,
    stopsLeft: Math.max(0, to - reached),
    status,
    time: stops[to].Time,
  };
}

const zurichClock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

// "08:14" in Lugano as milliseconds: the closest such time to `now`, also
// across midnight. Undefined for anything else.
export function clockAt(time: string, now: number): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (match === null) return undefined;
  const parts = Object.fromEntries(
    zurichClock.formatToParts(now).map((part) => [part.type, Number(part.value)])
  );
  const current = parts.hour * 3600 + parts.minute * 60 + parts.second;
  let diff = Number(match[1]) * 3600 + Number(match[2]) * 60 - current;
  if (diff < -12 * 3600) diff += 24 * 3600;
  if (diff > 12 * 3600) diff -= 24 * 3600;
  return now - (now % 1000) + diff * 1000;
}

// The stop to get off with what the latest routing tells: the bus has left,
// its time at the stop, its arrival. The same object when nothing changed.
export function followRide(getOff: GetOff, ride: Ride | undefined, now: number): GetOff {
  if (ride === undefined) return getOff;
  const left = getOff.left === true || ride.left;
  // Once there, the time of the stop is history: keep the last forecast
  const arrivalAt =
    getOff.arrivedAt === undefined
      ? (clockAt(ride.time, now) ?? getOff.arrivalAt)
      : getOff.arrivalAt;
  const arrived = ride.status === "at" || ride.status === "passed";
  const arrivedAt = getOff.arrivedAt ?? (arrived ? now : undefined);
  return left === (getOff.left === true) &&
    arrivalAt === getOff.arrivalAt &&
    arrivedAt === getOff.arrivedAt
    ? getOff
    : { ...getOff, left, arrivalAt, arrivedAt };
}

// Without the routing, the GPS tells the bus is about to reach the stop
export const GET_OFF_NEAR_METERS = 300;

// The alert to show now, each once. `departed`: the bus should have left the
// stop of the user, before which the GPS tells nothing about the ride.
export function dueGetOffAlert(
  ride: Ride | undefined,
  distance: number | undefined,
  alerted: ReadonlyArray<GetOffAlert>,
  departed: boolean
): GetOffAlert | undefined {
  if (alerted.includes("now")) return undefined;
  if (ride !== undefined) {
    if (ride.status === "at") return "now";
    // Once past the stop it is too late to tell
    return ride.status === "next" && !alerted.includes("next") ? "next" : undefined;
  }
  return departed && distance !== undefined && distance < GET_OFF_NEAR_METERS
    ? "now"
    : undefined;
}

export function getOffMessage(
  alert: GetOffAlert,
  { name }: Pick<GetOff, "name">,
  line: string,
  destination: string
): AlertMessage {
  const bus = `Linea ${line} per ${destination}`;
  return alert === "next"
    ? { title: `Prossima fermata: ${name}`, body: `Preparati a scendere · ${bus}` }
    : { title: `Scendi ora a ${name}`, body: bus };
}

// Main line of the timer once on board: undefined until the bus has left the
// stop of the user, when the timer still counts down to it
export function getOffHeadline(
  getOff: GetOff,
  ride: Ride | undefined,
  departed: boolean,
  now: number
): Headline | undefined {
  if (!(ride?.left ?? departed)) return undefined;
  const { name } = getOff;
  if (ride?.status === "at") return { label: `Scendi ora a ${name}`, ms: 0, phase: "arrival" };
  if (ride?.status === "passed" || getOff.arrivedAt !== undefined) {
    return { label: `Arrivato a ${name}`, ms: 0, phase: "arrival" };
  }
  // Told to get off by the GPS
  if (getOff.alerted.includes("now")) {
    return { label: `Scendi ora a ${name}`, ms: 0, phase: "arrival" };
  }
  const ms = getOff.arrivalAt === undefined ? 0 : getOff.arrivalAt - now;
  return ms > 0
    ? { label: `Scendi a ${name} tra`, ms, phase: "arrival" }
    : { label: `In arrivo a ${name}`, ms: 0, phase: "arrival" };
}

// What is left of the ride, under the headline
export function rideSummary(getOff: GetOff, ride: Ride | undefined): string {
  if (ride === undefined) {
    return getOff.arrivedAt === undefined
      ? `In viaggio verso ${getOff.name}`
      : "Il bus ha lasciato la fermata";
  }
  switch (ride.status) {
    case "passed":
      return "Il bus ha lasciato la fermata";
    case "at":
      return "Il bus è alla fermata";
    case "next":
      return "Prossima fermata";
    case "before":
      return ride.stopsLeft === 1 ? "Prossima fermata" : `Ancora ${ride.stopsLeft} fermate`;
  }
}
