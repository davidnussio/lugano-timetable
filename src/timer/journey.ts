// Pure logic behind a journey with transfers: whether each connection can
// still be made with the real-time data, which bus to catch first and what
// to tell the user. Like `plan.ts`, kept free of browser APIs.

import type { Messages } from "~/i18n/messages";
import {
  type AlertMessage,
  climbFactor,
  type Countdown,
  countdown,
  distanceMeters,
  minutesLeft,
  PACE_SPEED,
  type Position,
  walkingSeconds,
} from "./plan";
import type { Headline } from "./tone";

// A scheduled time with the latest real-time estimate, in milliseconds
export interface Timing {
  readonly scheduled: number;
  readonly estimated?: number;
}

export interface JourneyStop {
  readonly name: string;
  readonly position?: Position;
}

// A ride on a single bus (or train), from boarding to getting off
export interface Leg {
  readonly line: string;
  readonly destination: string;
  readonly from: JourneyStop;
  readonly to: JourneyStop;
  readonly departure: Timing;
  readonly arrival: Timing;
  // Walk before boarding as planned by the timetable, at the default normal
  // pace
  readonly walkBeforeMs?: number;
}

export type ConnectionStatus = "ok" | "tight" | "missed";

export interface Transfer {
  readonly at: JourneyStop;
  // Walk from the stop where the previous leg ends to the next platform
  readonly walkingMs: number;
  // Meters to go up on the way (negative downhill), when the heights are known
  readonly climb?: number;
  // Time to spare at the next platform: negative when the connection is lost
  readonly slackMs: number;
  readonly status: ConnectionStatus;
}

export interface TransferOptions {
  // Walking speed of the user in meters per second, as of `paceSpeeds`
  readonly speed?: number;
  // Getting off, finding the platform: added to every transfer without a
  // walk planned by the timetable
  readonly minimumMs?: number;
  // Below this slack the connection is tight
  readonly tightMs?: number;
  // Height above the sea of a stop, when known: the walk slows down uphill
  readonly heightOf?: HeightOf;
}

export type HeightOf = (position: Position) => number | undefined;

const MINIMUM_TRANSFER_MS = 60_000;
const TIGHT_TRANSFER_MS = 2 * 60_000;

// The best known time: the estimate when there is one
export function expected(timing: Timing): number {
  return timing.estimated ?? timing.scheduled;
}

// Delay in milliseconds, negative when early, 0 without real-time data
export function delayMs(timing: Timing): number {
  return expected(timing) - timing.scheduled;
}

// Meters to go up from a stop to another, when both heights are known
export function stopClimb(
  from: JourneyStop,
  to: JourneyStop,
  heightOf: HeightOf | undefined
): number | undefined {
  if (heightOf === undefined || from.position === undefined || to.position === undefined) {
    return undefined;
  }
  const start = heightOf(from.position);
  const end = heightOf(to.position);
  return start === undefined || end === undefined ? undefined : end - start;
}

// Walk between the stop where a leg ends and where the next one starts.
// Platforms of the same stop without a position are assumed to be close.
export function transferWalkingMs(
  from: JourneyStop,
  to: JourneyStop,
  speed = PACE_SPEED.normal,
  climb = 0
): number {
  if (from.position === undefined || to.position === undefined) return 0;
  return (
    walkingSeconds(distanceMeters(from.position, to.position), speed, climb) * 1000
  );
}

// `plannedSlackMs`: the slack on schedule. A connection planned with less
// than `tightMs` to spare is only tight once delays eat into it.
// `toleranceMs`: how far below zero the slack may go before it is lost.
export function connectionStatus(
  slackMs: number,
  tightMs = TIGHT_TRANSFER_MS,
  plannedSlackMs = Number.POSITIVE_INFINITY,
  toleranceMs = 0
): ConnectionStatus {
  if (slackMs < -toleranceMs) return "missed";
  return slackMs < Math.min(tightMs, Math.max(plannedSlackMs, 0))
    ? "tight"
    : "ok";
}

export function transfer(
  arriving: Leg,
  departing: Leg,
  {
    speed = PACE_SPEED.normal,
    minimumMs = MINIMUM_TRANSFER_MS,
    tightMs = TIGHT_TRANSFER_MS,
    heightOf,
  }: TransferOptions = {}
): Transfer {
  const planned = departing.walkBeforeMs;
  const climb = stopClimb(arriving.to, departing.from, heightOf);
  // The walk of the timetable is a fixed time: slow it down uphill as ours
  const uphill =
    climb === undefined || arriving.to.position === undefined || departing.from.position === undefined
      ? 1
      : climbFactor(distanceMeters(arriving.to.position, departing.from.position), climb);
  // The walk of the timetable is already its minimum transfer time: no
  // margin on top, and a slower pace or a climb leaves no slack but does not
  // make the connection impossible
  const walkingMs =
    planned === undefined
      ? transferWalkingMs(arriving.to, departing.from, speed, climb)
      : ((planned * PACE_SPEED.normal) / speed) * uphill;
  const neededMs = walkingMs + (planned === undefined ? minimumMs : 0);
  const toleranceMs = planned === undefined ? 0 : Math.max(walkingMs - planned, 0);
  const slackMs =
    expected(departing.departure) - expected(arriving.arrival) - neededMs;
  const plannedSlackMs =
    departing.departure.scheduled - arriving.arrival.scheduled - neededMs;
  return {
    at: arriving.to,
    walkingMs,
    ...(climb === undefined ? {} : { climb }),
    slackMs,
    status: connectionStatus(slackMs, tightMs, plannedSlackMs, toleranceMs),
  };
}

const severity: Record<ConnectionStatus, number> = {
  ok: 0,
  tight: 1,
  missed: 2,
};

export interface JourneyState {
  // Countdown to the first bus, as for a single departure
  readonly start: Countdown;
  readonly transfers: ReadonlyArray<Transfer>;
  // The worst of the transfers: "ok" without transfers
  readonly status: ConnectionStatus;
  readonly arrivalAt: number;
}

export function journeyState(
  legs: ReadonlyArray<Leg>,
  now: number,
  walkSeconds: number | undefined,
  options?: TransferOptions
): JourneyState {
  const [first, ...rest] = legs;
  if (first === undefined) throw new Error("A journey needs at least one leg");
  const transfers = rest.map((leg, index) =>
    transfer(legs[index], leg, options)
  );
  const status = transfers.reduce<ConnectionStatus>(
    (worst, { status }) =>
      severity[status] > severity[worst] ? status : worst,
    "ok"
  );
  return {
    start: countdown(expected(first.departure), now, walkSeconds),
    transfers,
    status,
    arrivalAt: expected(legs[legs.length - 1].arrival),
  };
}

// A way to the destination: the journey followed, or one of the plans of
// the timetable
export interface Plan {
  readonly legs: ReadonlyArray<Leg>;
}

const planDeparture = (plan: Plan) => expected(plan.legs[0].departure);
const planArrival = (plan: Plan) => expected(plan.legs[plan.legs.length - 1].arrival);

// Whether all the transfers of a plan can still be made
export function feasible(plan: Plan, options?: TransferOptions): boolean {
  return plan.legs.every(
    (leg, index) =>
      index === 0 ||
      transfer(plan.legs[index - 1], leg, options).status !== "missed"
  );
}

// The same bus at the same stop and time
const sameDeparture = (a: Leg, b: Leg) =>
  a.line === b.line &&
  a.from.name === b.from.name &&
  a.departure.scheduled === b.departure.scheduled;

// The plan to fall back on when the connection from `arriving` to
// `departing` is lost: the one arriving first among those that can be
// caught once off `arriving`, never `departing` itself
export function fallbackPlan<P extends Plan>(
  plans: ReadonlyArray<P>,
  arriving: Leg,
  departing: Leg,
  options?: TransferOptions
): P | undefined {
  let best: P | undefined;
  for (const plan of plans) {
    const [first] = plan.legs;
    if (first === undefined || sameDeparture(first, departing)) continue;
    if (transfer(arriving, first, options).status === "missed") continue;
    if (!feasible(plan, options)) continue;
    if (best === undefined || planArrival(plan) < planArrival(best)) {
      best = plan;
    }
  }
  return best;
}

// A plan leaving later than `current` without arriving later: when a bus of
// the journey is delayed, an earlier one may be caught later and still be in
// time. The latest of them, to stay home as long as possible.
export function laterPlan<P extends Plan>(
  plans: ReadonlyArray<P>,
  current: Plan,
  options?: TransferOptions
): P | undefined {
  const departure = planDeparture(current);
  const arrival = planArrival(current);
  let best: P | undefined;
  for (const plan of plans) {
    if (plan.legs.length === 0) continue;
    if (planDeparture(plan) <= departure || planArrival(plan) > arrival) continue;
    if (!feasible(plan, options)) continue;
    if (best === undefined || planDeparture(plan) > planDeparture(best)) {
      best = plan;
    }
  }
  return best;
}

const clock = new Intl.DateTimeFormat("it-CH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

// "08:14" in Lugano, whatever the time zone of the device
export function formatTime(ms: number): string {
  return clock.format(ms);
}

export interface Alternative {
  // The first leg of the plan to fall back on
  readonly leg: Leg;
  // How much later it arrives than the journey
  readonly laterMs: number;
}

// What to tell the user about the connection with `departing`. Nothing while
// it is fine; `alternative` is the way to fall back on when it is lost.
export function transferMessage(
  m: Messages,
  departing: Leg,
  { at, slackMs, status }: Transfer,
  alternative?: Alternative
): AlertMessage | undefined {
  const bus = m.alerts.bus(departing.line, departing.destination);
  switch (status) {
    case "ok":
      return undefined;
    case "tight": {
      const spare = Math.floor(slackMs / 60_000);
      return {
        title: m.alerts.tightTransfer(at.name),
        body: `${bus} · ${spare > 0 ? m.timer.spareMinutes(spare) : m.alerts.noSpare}`,
      };
    }
    case "missed": {
      const title = m.alerts.transferAtRisk(at.name);
      if (alternative === undefined) {
        return { title, body: `${bus} · ${m.alerts.lateBy(minutesLeft(-slackMs))}` };
      }
      const { leg, laterMs } = alternative;
      return {
        title,
        body: m.alerts.nextLine(
          leg.line,
          formatTime(expected(leg.departure)),
          minutesLeft(laterMs)
        ),
      };
    }
  }
}

// What comes next once on board: getting off for a transfer, or the arrival.
// Undefined before the first departure, when the timer counts down to it.
export function journeyHeadline(
  m: Messages,
  legs: ReadonlyArray<Leg>,
  now: number
): Headline | undefined {
  if (legs.length === 0 || expected(legs[0].departure) > now) return undefined;
  const index = legs.findIndex((leg) => expected(leg.arrival) > now);
  if (index === -1) return { label: m.headline.arrived, ms: 0, phase: "arrival" };
  const leg = legs[index];
  // Between two legs: waiting for the next bus
  if (expected(leg.departure) > now) {
    return { label: m.headline.lineIn(leg.line), ms: expected(leg.departure) - now, phase: "bus" };
  }
  const ms = expected(leg.arrival) - now;
  if (index === legs.length - 1) return { label: m.headline.arrivalIn, ms, phase: "arrival" };
  return { label: m.headline.getOffIn(leg.to.name), ms, phase: "transfer" };
}
