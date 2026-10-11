// Pure logic behind a journey with transfers: whether each connection can
// still be made with the real-time data, which bus to catch first and what
// to tell the user. Like `plan.ts`, kept free of browser APIs.

import {
  type AlertMessage,
  type Countdown,
  countdown,
  distanceMeters,
  minutesLeft,
  type Pace,
  type Position,
  walkingSeconds,
} from "./plan";

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
}

export type ConnectionStatus = "ok" | "tight" | "missed";

export interface Transfer {
  readonly at: JourneyStop;
  // Walk from the stop where the previous leg ends to the next platform
  readonly walkingMs: number;
  // Time to spare at the next platform: negative when the connection is lost
  readonly slackMs: number;
  readonly status: ConnectionStatus;
}

export interface TransferOptions {
  readonly pace?: Pace;
  // Getting off, finding the platform: added to every transfer
  readonly minimumMs?: number;
  // Below this slack the connection is tight
  readonly tightMs?: number;
}

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

// Walk between the stop where a leg ends and where the next one starts.
// Platforms of the same stop without a position are assumed to be close.
export function transferWalkingMs(
  from: JourneyStop,
  to: JourneyStop,
  pace: Pace = "normal"
): number {
  if (from.position === undefined || to.position === undefined) return 0;
  return (
    walkingSeconds(distanceMeters(from.position, to.position), pace) * 1000
  );
}

export function connectionStatus(
  slackMs: number,
  tightMs = TIGHT_TRANSFER_MS
): ConnectionStatus {
  if (slackMs < 0) return "missed";
  return slackMs < tightMs ? "tight" : "ok";
}

export function transfer(
  arriving: Leg,
  departing: Leg,
  {
    pace = "normal",
    minimumMs = MINIMUM_TRANSFER_MS,
    tightMs = TIGHT_TRANSFER_MS,
  }: TransferOptions = {}
): Transfer {
  const walkingMs = transferWalkingMs(arriving.to, departing.from, pace);
  const slackMs =
    expected(departing.departure) -
    (expected(arriving.arrival) + walkingMs + minimumMs);
  return {
    at: arriving.to,
    walkingMs,
    slackMs,
    status: connectionStatus(slackMs, tightMs),
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

// The latest of the `candidates` (e.g. the next buses of the first line)
// that still makes the connection with `departing`: when the next bus is
// delayed, an earlier one may be caught later and still be in time.
export function latestConnecting(
  candidates: ReadonlyArray<Leg>,
  departing: Leg,
  options?: TransferOptions
): Leg | undefined {
  let best: Leg | undefined;
  for (const candidate of candidates) {
    if (transfer(candidate, departing, options).status === "missed") continue;
    if (
      best === undefined ||
      expected(candidate.departure) > expected(best.departure)
    ) {
      best = candidate;
    }
  }
  return best;
}

// The first of the `candidates` (e.g. the next buses of the line to change
// to) that can be caught after `arriving`: the fallback for a lost
// connection.
export function earliestConnecting(
  arriving: Leg,
  candidates: ReadonlyArray<Leg>,
  options?: TransferOptions
): Leg | undefined {
  let best: Leg | undefined;
  for (const candidate of candidates) {
    if (transfer(arriving, candidate, options).status === "missed") continue;
    if (
      best === undefined ||
      expected(candidate.departure) < expected(best.departure)
    ) {
      best = candidate;
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

// What to tell the user about the connection with `departing`. Nothing while
// it is fine; `alternative` is the bus to fall back on when it is lost.
export function transferMessage(
  departing: Leg,
  { at, slackMs, status }: Transfer,
  alternative?: Leg
): AlertMessage | undefined {
  const bus = `Linea ${departing.line} per ${departing.destination}`;
  switch (status) {
    case "ok":
      return undefined;
    case "tight": {
      const spare = Math.floor(slackMs / 60_000);
      return {
        title: `Coincidenza stretta a ${at.name}`,
        body:
          spare > 0
            ? `${bus} · ${spare} min di margine`
            : `${bus} · nessun margine, affrettati`,
      };
    }
    case "missed": {
      const title = `Coincidenza a rischio a ${at.name}`;
      if (alternative === undefined) {
        return {
          title,
          body: `${bus} · in ritardo di ${minutesLeft(-slackMs)} min`,
        };
      }
      const later = minutesLeft(
        expected(alternative.arrival) - expected(departing.arrival)
      );
      return {
        title,
        body: `Prossima linea ${alternative.line} alle ${formatTime(expected(alternative.departure))}, arrivo ${later > 0 ? `+${later} min` : "invariato"}`,
      };
    }
  }
}
