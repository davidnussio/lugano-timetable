// How far the user is along the trip of the timer: the steps already behind
// (the walk to the stop, the wait there, every ride and transfer) and the
// stop the map leads to next. Like `plan.ts`, kept free of browser APIs.

import type { PlannedLeg } from "~/journey/models";
import { delayMs, expected, type JourneyStop, type Transfer } from "./journey";
import type { WalkTrack } from "./pace";
import type { Position, Stage } from "./plan";
import type { ActiveTimer } from "./store";

// The arrival at the stop of the timer seen with the GPS, with the walk that
// led there when it was followed from home
export interface AtStop {
  readonly at: number;
  readonly leftAt?: number;
  // Walked as the crow flies
  readonly meters?: number;
}

// The arrival at the stop, recorded once as `approach` moves from `before`
// to `after` with a fix `meters` from the stop at `at`. `walk` is the walk
// followed until then. Returns `previous` itself when nothing changes.
export function reachStop(
  previous: AtStop | undefined,
  before: Stage,
  after: Stage,
  walk: WalkTrack | undefined,
  { meters, at }: { readonly meters: number; readonly at: number }
): AtStop | undefined {
  if (previous !== undefined || before === "arrived" || after !== "arrived") return previous;
  // A walk with a bus on the way, or the GPS lost too long, is not a walk
  return walk === undefined || walk.spoiled === true
    ? { at }
    : { at, leftAt: walk.at, meters: Math.max(0, walk.meters - meters) };
}

interface Span {
  // When the step started, and how long it took: so far while not done
  readonly at: number;
  readonly ms: number;
  readonly done: boolean;
}

export type Step =
  | (Span & { readonly kind: "walk"; readonly to: string; readonly meters?: number })
  | (Span & { readonly kind: "wait"; readonly stop: string })
  | (Span & {
      readonly kind: "ride";
      // Of the rides of the trip: the first is the bus of the timer
      readonly index: number;
      readonly line: string;
      readonly category?: string;
      readonly operator?: string;
      readonly to: string;
      // Late (or early) at the departure, when the real-time data tell
      readonly delayMs?: number;
    })
  | (Span & { readonly kind: "transfer"; readonly stop: string; readonly walkingMs: number });

interface Ridden {
  readonly line: string;
  readonly category?: string;
  readonly operator?: string;
  readonly to: string;
  readonly departureAt: number;
  readonly arrivalAt: number | undefined;
  readonly delayMs?: number;
  readonly walkBeforeMs?: number;
}

// The rides of the trip: the legs of a journey, or a single bus followed to
// the stop to get off
function rides(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined
): ReadonlyArray<Ridden> {
  if (timer.journey !== undefined && legs !== undefined) {
    return legs.map((leg) => ({
      line: leg.line,
      category: leg.category,
      operator: leg.operator,
      to: leg.to.name,
      departureAt: expected(leg.departure),
      arrivalAt: expected(leg.arrival),
      ...(leg.departure.estimated === undefined ? {} : { delayMs: delayMs(leg.departure) }),
      walkBeforeMs: leg.walkBeforeMs,
    }));
  }
  const { getOff } = timer;
  if (getOff === undefined) return [];
  return [
    {
      line: timer.line,
      to: getOff.name,
      departureAt: timer.departureAt,
      // Only the routing tells when the bus is there
      arrivalAt: getOff.arrivedAt,
    },
  ];
}

// The steps of the trip up to `now`, the last one possibly still going on.
// `transfers`: the walks between the legs measured at the pace of the user.
export function tripSteps(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined,
  now: number,
  transfers?: ReadonlyArray<Transfer>
): ReadonlyArray<Step> {
  const all = rides(timer, legs);
  const departureAt = all[0]?.departureAt ?? timer.departureAt;
  const { atStop } = timer;
  const steps: Step[] = [];

  if (atStop?.leftAt !== undefined) {
    steps.push({
      kind: "walk",
      at: atStop.leftAt,
      ms: atStop.at - atStop.leftAt,
      done: true,
      to: timer.stop.name,
      ...(atStop.meters === undefined ? {} : { meters: atStop.meters }),
    });
  }
  // Too late for the bus: no wait, whatever comes next
  if (atStop !== undefined && atStop.at < departureAt) {
    steps.push({
      kind: "wait",
      at: atStop.at,
      ms: Math.min(now, departureAt) - atStop.at,
      done: now >= departureAt,
      stop: timer.stop.name,
    });
  }

  for (const [index, ride] of all.entries()) {
    const before = all[index - 1];
    if (before !== undefined) {
      if (before.arrivalAt === undefined || before.arrivalAt > now) break;
      steps.push({
        kind: "transfer",
        at: before.arrivalAt,
        ms: Math.max(0, Math.min(now, ride.departureAt) - before.arrivalAt),
        done: now >= ride.departureAt,
        stop: before.to,
        walkingMs: transfers?.[index - 1]?.walkingMs ?? ride.walkBeforeMs ?? 0,
      });
    }
    if (ride.departureAt > now) break;
    const done = ride.arrivalAt !== undefined && ride.arrivalAt <= now;
    steps.push({
      kind: "ride",
      at: ride.departureAt,
      ms: (done ? (ride.arrivalAt ?? now) : now) - ride.departureAt,
      done,
      index,
      line: ride.line,
      ...(ride.category === undefined ? {} : { category: ride.category }),
      ...(ride.operator === undefined ? {} : { operator: ride.operator }),
      to: ride.to,
      ...(ride.delayMs === undefined ? {} : { delayMs: ride.delayMs }),
    });
  }
  return steps;
}

// "board": a bus to catch there; "getOff": on board, the stop to get off;
// "destination": the end of the journey
export type StopKind = "board" | "getOff" | "destination";

export interface NextStop {
  readonly kind: StopKind;
  readonly name: string;
  readonly position: Position;
}

const located = (kind: StopKind, stop: JourneyStop): NextStop | undefined =>
  stop.position === undefined
    ? undefined
    : { kind, name: stop.name, position: stop.position };

// Where the map leads once the bus of the timer has left: the stop to get off,
// the next bus at a transfer, then the destination. Undefined before, when it
// is the stop of the timer, or when the position of the stop is unknown.
export function nextStop(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined,
  now: number
): NextStop | undefined {
  if (timer.journey !== undefined) {
    if (legs === undefined || legs.length === 0 || expected(legs[0].departure) > now) {
      return undefined;
    }
    const index = legs.findIndex((leg) => expected(leg.arrival) > now);
    if (index === -1) return located("destination", timer.journey.to);
    const leg = legs[index];
    return expected(leg.departure) > now
      ? located("board", leg.from)
      : located("getOff", leg.to);
  }
  const { getOff } = timer;
  return getOff === undefined || now < timer.departureAt ? undefined : located("getOff", getOff);
}

// What tells most about the ride under the countdown, next to its departure
// and arrival
export type TravelExtra =
  // Late (or early) at the next stop of the leg: undefined without real-time
  // data
  | { readonly kind: "delay"; readonly ms: number | undefined }
  // Stops still to reach on a single bus, once the routing tells
  | { readonly kind: "stops"; readonly stops: number | undefined }
  // The whole trip, once there
  | { readonly kind: "duration"; readonly ms: number }
  // The walk left from the last stop to the destination
  | { readonly kind: "walk"; readonly ms: number };

export interface TravelStats {
  readonly departureAt: number;
  readonly arrivalAt: number | undefined;
  readonly extra: TravelExtra;
}

const delayOf = (timing: PlannedLeg["departure"]) =>
  timing.estimated === undefined ? undefined : delayMs(timing);

// The ride under way (or the next bus at a transfer) once the bus of the
// timer has left: undefined before, when the countdown is about the walk.
// `stopsLeft`: from the routing of a single bus, when followed.
export function travelStats(
  timer: ActiveTimer,
  legs: ReadonlyArray<PlannedLeg> | undefined,
  stopsLeft: number | undefined,
  now: number
): TravelStats | undefined {
  if (timer.journey !== undefined) {
    const first = legs?.[0];
    const last = legs?.at(-1);
    if (legs === undefined || first === undefined || last === undefined) return undefined;
    if (expected(first.departure) > now) return undefined;
    const leg = legs.find((each) => expected(each.arrival) > now);
    if (leg !== undefined) {
      const departed = expected(leg.departure) <= now;
      return {
        departureAt: expected(leg.departure),
        arrivalAt: expected(leg.arrival),
        // Waiting at a transfer the next departure matters, on board the
        // arrival
        extra: { kind: "delay", ms: delayOf(departed ? leg.arrival : leg.departure) },
      };
    }
    const walkAfterMs = timer.journey.walkAfterMs ?? 0;
    return {
      departureAt: expected(first.departure),
      arrivalAt: expected(last.arrival),
      extra:
        walkAfterMs > 0
          ? { kind: "walk", ms: walkAfterMs }
          : { kind: "duration", ms: expected(last.arrival) - expected(first.departure) },
    };
  }
  const { getOff } = timer;
  if (getOff === undefined || now < timer.departureAt) return undefined;
  return {
    departureAt: timer.departureAt,
    arrivalAt: getOff.arrivedAt ?? getOff.arrivalAt,
    extra:
      getOff.arrivedAt === undefined
        ? { kind: "stops", stops: stopsLeft }
        : { kind: "duration", ms: getOff.arrivedAt - timer.departureAt },
  };
}
