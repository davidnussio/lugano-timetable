// The trips done with the timer, kept in the history of the device: from the
// walk to the stop to the arrival, with the delays of every bus, the weather
// and the time of the day. Like `timer/plan.ts`, kept free of browser APIs.

import type { CurrentWeather } from "~/weather/open-meteo-client";
import { expected } from "~/timer/journey";
import type { Pace, WeatherKind } from "~/timer/plan";
import type { ActiveTimer } from "~/timer/store";
import { timerEndsAt } from "~/timer/store";
import { isTicinoHoliday } from "~/timetable/calendar";
import { type DayType, dayType, scheduledInstant, zurichTime } from "~/timetable/reliability";

// A time of the trip, in milliseconds
export interface TripTime {
  // As in the timetable, when known
  readonly scheduled?: number;
  // As it happened: the latest real-time estimate, or the arrival seen
  readonly actual?: number;
}

// One bus (or train) of the trip
export interface RideRecord {
  readonly line: string;
  // "B" (bus), "S", "RE"…: only for the legs of a journey
  readonly category?: string;
  readonly operator?: string;
  // Where the bus is heading, as on its front
  readonly destination: string;
  // Where the user got on and off, with the town: "Lugano, Via Brentani"
  readonly from: string;
  readonly to?: string;
  readonly departure: TripTime;
  readonly arrival?: TripTime;
}

// The weather at the stop before the bus left, as Open-Meteo tells it
export interface TripWeather extends CurrentWeather {
  // What slows the walk down, undefined when dry
  readonly kind?: WeatherKind;
}

export type TripKind = "bus" | "journey" | "onBoard";

export interface TripRecord {
  // When the timer was started: unique on a device
  readonly id: number;
  readonly kind: TripKind;
  readonly startedAt: number;
  readonly endedAt: number;
  // Whether the trip went to its end: false when the timer was stopped
  // on the way
  readonly completed: boolean;
  // Day of the first departure in Lugano, its type for the timetable (the
  // holidays of Ticino run as Sundays) and its hour
  readonly date: string;
  readonly dayType: DayType;
  readonly holiday: boolean;
  readonly hour: number;
  // From the stop of the timer to the destination of the journey, the stop
  // to get off or the end of the line
  readonly from: string;
  readonly to: string;
  readonly rides: ReadonlyArray<RideRecord>;
  // The walk to the stop, when followed with the GPS from home
  readonly walk?: {
    readonly leftAt: number;
    readonly ms: number;
    readonly meters?: number;
  };
  // Waiting at the stop for the first bus, once there with the GPS
  readonly waitMs?: number;
  // From the last stop to the destination of a journey
  readonly walkAfterMs?: number;
  // Door to door when the walks are known, from the first departure otherwise
  readonly durationMs: number;
  readonly weather?: TripWeather;
  readonly pace: Pace;
  // Alerts to leave shown
  readonly alerts: number;
}

// The bus of the timer as seen in the real-time data of its stop
const followed = (timer: ActiveTimer) => timer.routing !== "" || timer.uid !== undefined;

// A bus the user was already on: no alert to leave, started once it had left
const onBoard = (timer: ActiveTimer) =>
  timer.journey === undefined &&
  timer.thresholds.length === 0 &&
  timer.departureAt <= timer.startedAt &&
  timer.getOff !== undefined;

function timerRides(timer: ActiveTimer, until: number): ReadonlyArray<RideRecord> {
  const { journey, getOff } = timer;
  if (journey !== undefined) {
    return journey.legs
      .filter((leg) => expected(leg.departure) <= until)
      .map((leg, index) => {
        // The first bus of TPL is followed closer by its stop than by the
        // timetable
        const departed =
          index === 0 && followed(timer) ? timer.departureAt : leg.departure.estimated;
        return {
          line: leg.line,
          category: leg.category,
          ...(leg.operator === undefined ? {} : { operator: leg.operator }),
          destination: leg.destination,
          from: index === 0 ? timer.stop.label : leg.from.name,
          to: leg.to.name,
          departure: {
            scheduled: leg.departure.scheduled,
            ...(departed === undefined ? {} : { actual: departed }),
          },
          arrival: {
            scheduled: leg.arrival.scheduled,
            ...(leg.arrival.estimated === undefined ? {} : { actual: leg.arrival.estimated }),
          },
        };
      });
  }
  // On board the time of the routing is all there is: no delay to tell
  const scheduled = onBoard(timer) ? undefined : scheduledInstant(timer.time, timer.departureAt);
  return [
    {
      line: timer.line,
      destination: timer.destination,
      from: timer.stop.label,
      ...(getOff === undefined ? {} : { to: getOff.name }),
      departure: {
        ...(scheduled === undefined ? {} : { scheduled }),
        actual: timer.departureAt,
      },
      ...(getOff?.arrivedAt === undefined ? {} : { arrival: { actual: getOff.arrivedAt } }),
    },
  ];
}

// The trip of the timer once it is over at `now`, or stopped by the user.
// Undefined when the first bus had not left yet: nothing happened.
export function tripRecord(
  timer: ActiveTimer,
  { now, pace }: { readonly now: number; readonly pace: Pace }
): TripRecord | undefined {
  if (now < timer.departureAt) return undefined;
  const endsAt = timerEndsAt(timer);
  const completed = now >= endsAt;
  const endedAt = Math.min(now, endsAt);
  const rides = timerRides(timer, endedAt);
  const first = rides[0];
  if (first === undefined) return undefined;
  const departedAt = first.departure.actual ?? first.departure.scheduled ?? timer.departureAt;
  const local = zurichTime(departedAt);
  const holiday = isTicinoHoliday(local.date);
  const { atStop, journey, getOff } = timer;

  const walk =
    atStop?.leftAt === undefined
      ? undefined
      : {
          leftAt: atStop.leftAt,
          ms: atStop.at - atStop.leftAt,
          ...(atStop.meters === undefined ? {} : { meters: atStop.meters }),
        };
  const waitMs =
    atStop !== undefined && atStop.at < departedAt ? departedAt - atStop.at : undefined;
  const walkAfterMs = completed ? journey?.walkAfterMs : undefined;

  return {
    id: timer.startedAt,
    kind: journey !== undefined ? "journey" : onBoard(timer) ? "onBoard" : "bus",
    startedAt: timer.startedAt,
    endedAt,
    completed,
    date: local.date,
    dayType: holiday ? "sunday" : dayType(local.weekday),
    holiday,
    hour: Math.floor(local.ms / 3_600_000),
    from: timer.stop.label,
    to: journey?.to.name ?? getOff?.name ?? timer.destination,
    rides,
    ...(walk === undefined ? {} : { walk }),
    ...(waitMs === undefined ? {} : { waitMs }),
    ...(walkAfterMs === undefined ? {} : { walkAfterMs }),
    durationMs: endedAt - (walk?.leftAt ?? departedAt),
    ...(timer.weather === undefined ? {} : { weather: timer.weather }),
    pace,
    alerts: timer.fired.length,
  };
}

// About a year of daily trips: well within the space of localStorage
export const MAX_TRIPS = 1000;

// The history with the trip added, the oldest dropped past `MAX_TRIPS`. A
// trip already there (the same timer) is replaced.
export function addTrip(
  history: ReadonlyArray<TripRecord>,
  trip: TripRecord
): ReadonlyArray<TripRecord> {
  return [...history.filter((other) => other.id !== trip.id), trip]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-MAX_TRIPS);
}
