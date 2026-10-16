// Pure logic behind the notifications of the usual journeys: which trip to
// watch at a given time (in Lugano, whatever the time zone of the server),
// which connection to take, when to leave and what to send. The tick runs
// every minute and may overlap with itself: every decision depends only on
// what was already sent, stored per routine and day.

import type { Connection } from "~/journey/models";
import { delayMs, expected, feasible, transfer } from "~/timer/journey";
import type { PushMessage, Routine } from "./models";

const MIN = 60_000;

// The first notification, before leaving home
export const FIRST_LEAD_MS = 20 * MIN;
// The journey may take longer than when it was saved, or the last bus in
// time leave much earlier (a bus every hour): start looking an hour before
const WINDOW_MARGIN_MS = 60 * MIN;
// Far from leaving the plan barely changes: look again every few minutes
const FAR_CHECK_MS = 5 * MIN;
// A second tick in the same minute (a retry of the scheduler) is ignored
const RECHECK_MS = 30_000;
// The ticks come every minute: "Esci ora" a few seconds early rather than
// almost a minute late
const NOW_LEAD_MS = 45_000;
// A leave time just passed can still be made, hurrying a little
const LEAVE_GRACE_MS = MIN;
// Changes of the leave time worth an update
export const UPDATE_MS = 2 * MIN;
// Against a forecast going back and forth
const MAX_UPDATES = 5;

export const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;

const localDate = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Zurich",
});

const localDateTime = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

// "2026-10-16", the day in Lugano
export function zurichDate(ms: number): string {
  return localDate.format(ms);
}

// ISO weekday of a calendar day, 1 for Monday
export function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// How far the clocks of Lugano are ahead of UTC at `ms`: 1 or 2 hours
function zurichOffsetMs(ms: number): number {
  const [date, time] = localDateTime.format(ms).split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(ms / 1000) * 1000;
}

const WINTER_MS = 60 * MIN;
const SUMMER_MS = 2 * 60 * MIN;

// The instant of a local time ("07:55") of a day in Lugano. A time repeated
// when the clocks go back is the first one; a time skipped when they go
// forward is read with the winter offset, an hour later on the clocks.
export function zurichTime(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const summer = wall - SUMMER_MS;
  if (zurichOffsetMs(summer) === SUMMER_MS) return summer;
  return wall - WINTER_MS;
}

export interface Occurrence {
  // The day of the arrival
  readonly date: string;
  readonly arriveAt: number;
}

// When to start looking for the trip of a day
export function windowStart(routine: Routine, arriveAt: number): number {
  return (
    arriveAt -
    (routine.durationMinutes + routine.walkMinutes) * MIN -
    FIRST_LEAD_MS -
    WINDOW_MARGIN_MS
  );
}

// The trip to watch at `now`, if any: today's, or tomorrow's when it arrives
// just after midnight
export function occurrence(routine: Routine, now: number): Occurrence | undefined {
  if (routine.paused) return undefined;
  const today = zurichDate(now);
  for (const date of [today, addDays(today, 1)]) {
    if (!routine.days.includes(weekday(date))) continue;
    const arriveAt = zurichTime(date, routine.arriveBy);
    if (now >= windowStart(routine, arriveAt) && now <= arriveAt) {
      return { date, arriveAt };
    }
  }
  return undefined;
}

export interface RoutinePlan {
  readonly connection: Connection;
  // The same buses at the same times
  readonly key: string;
  readonly leaveAt: number;
  readonly arrivalAt: number;
  // No connection arrives in time: the first one to arrive
  readonly late: boolean;
}

export function connectionKey({ legs }: Connection): string {
  return legs.map((leg) => `${leg.trip}@${leg.departure.scheduled}`).join("|");
}

export function connectionArrival({ legs, walkAfterMs }: Connection): number {
  return expected(legs[legs.length - 1].arrival) + (walkAfterMs ?? 0);
}

const leaveTime = (connection: Connection, walkMinutes: number) =>
  expected(connection.legs[0].departure) - walkMinutes * MIN;

// The connection to take: the latest one arriving in time with its transfers
// still feasible, to stay home as long as possible. When none is in time,
// the first one to arrive.
export function choosePlan(
  connections: ReadonlyArray<Connection>,
  routine: Routine,
  arriveAt: number,
  now: number
): RoutinePlan | undefined {
  const plans = connections
    .filter((connection) => connection.legs.length > 0 && feasible(connection))
    .map((connection) => ({
      connection,
      key: connectionKey(connection),
      leaveAt: leaveTime(connection, routine.walkMinutes),
      arrivalAt: connectionArrival(connection),
    }))
    .filter((plan) => plan.leaveAt >= now - LEAVE_GRACE_MS);

  let best: (typeof plans)[number] | undefined;
  for (const plan of plans) {
    if (plan.arrivalAt > arriveAt) continue;
    if (
      best === undefined ||
      plan.leaveAt > best.leaveAt ||
      (plan.leaveAt === best.leaveAt && plan.arrivalAt < best.arrivalAt)
    ) {
      best = plan;
    }
  }
  if (best !== undefined) return { ...best, late: false };

  let first: (typeof plans)[number] | undefined;
  for (const plan of plans) {
    if (first === undefined || plan.arrivalAt < first.arrivalAt) first = plan;
  }
  return first && { ...first, late: true };
}

// What was sent for a routine on a day, or seen before the first message
export interface RoutineState {
  readonly checkedAt: number;
  // The plan of the last message, or the latest seen before the first one
  readonly key?: string;
  readonly leaveAt?: number;
  readonly stage?: "first" | "now";
  // Sent after the first message
  readonly updates?: number;
}

// Whether the timetable is worth asking again
export function shouldQuery(state: RoutineState | undefined, now: number): boolean {
  if (state === undefined) return true;
  if (state.stage === "now") return false;
  if (now - state.checkedAt < RECHECK_MS) return false;
  if (
    state.stage === undefined &&
    state.leaveAt !== undefined &&
    now < state.leaveAt - FIRST_LEAD_MS - FAR_CHECK_MS
  ) {
    return now - state.checkedAt >= FAR_CHECK_MS;
  }
  return true;
}

const shortClock = new Intl.DateTimeFormat("it-CH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

// "7:31" in Lugano
export function shortTime(ms: number): string {
  return shortClock.format(ms);
}

// Letters read with a vowel first ("esse", "erre", "i"…) take "l'"
const VOWEL_LETTERS = new Set("AEFHILMNORSUX");

// "il 6", "l'8", "l'S10", "il TILO": the line with its article
export function theLine(line: string): string {
  const digits = /^\d+/.exec(line)?.[0];
  const vowel =
    digits !== undefined
      ? digits === "1" || digits === "11" || /^8\d?$/.test(digits)
      : VOWEL_LETTERS.has(line.charAt(0).toUpperCase());
  return vowel ? `l'${line}` : `il ${line}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const delayMinutesOf = (plan: RoutinePlan) =>
  Math.round(delayMs(plan.connection.legs[0].departure) / MIN);

// "il 6 delle 7:37": the bus as written in the timetable
function busOf(plan: RoutinePlan): string {
  const first = plan.connection.legs[0];
  return `${theLine(first.line)} delle ${shortTime(first.departure.scheduled)}`;
}

function arrival(plan: RoutinePlan, routine: Routine): string {
  const at = `arrivo alle ${shortTime(plan.arrivalAt)}`;
  return plan.late ? `${at}, dopo le ${routine.arriveBy.replace(/^0/, "")}` : at;
}

function details(plan: RoutinePlan, routine: Routine, withBus: boolean): string {
  const first = plan.connection.legs[0];
  const delay = delayMinutesOf(plan);
  const transfers = plan.connection.legs.length - 1;
  return [
    withBus ? `${capitalize(busOf(plan))} da ${first.from.name}` : `Da ${first.from.name}`,
    ...(delay > 0 ? [`${delay} min di ritardo`] : []),
    ...(transfers > 0 ? [transfers === 1 ? "1 cambio" : `${transfers} cambi`] : []),
    arrival(plan, routine),
  ].join(" · ");
}

// Why the connection of the last message is no longer the one to take
function changeReason(
  previous: string | undefined,
  connections: ReadonlyArray<Connection>,
  arriveAt: number
): string {
  const old = connections.find((connection) => connectionKey(connection) === previous);
  if (old === undefined) return "Cambio di bus";
  const lost = old.legs.findIndex(
    (leg, index) => index > 0 && transfer(old.legs[index - 1], leg).status === "missed"
  );
  if (lost > 0) return `Coincidenza persa a ${old.legs[lost - 1].to.name}`;
  if (connectionArrival(old) > arriveAt) {
    return `${capitalize(theLine(old.legs[0].line))} non arriva in tempo`;
  }
  return "Puoi uscire più tardi";
}

export interface Decision {
  readonly state: RoutineState;
  readonly message?: PushMessage;
  // Of the message: after the leave time it is of no use
  readonly expiresAt?: number;
}

export const routineTag = (routine: Routine) => `routine-${routine.id}`;

// What to send now, given what was sent: the first notice about 20 minutes
// before leaving, an update when the leave time moves by 2 minutes or more
// or the connection changes (a transfer lost, a bus too late), and "Esci
// ora" at the leave time. Nothing once "Esci ora" is sent.
export function decide(
  routine: Routine,
  { arriveAt }: Occurrence,
  state: RoutineState | undefined,
  connections: ReadonlyArray<Connection>,
  now: number
): Decision {
  if (state?.stage === "now") return { state };
  const plan = choosePlan(connections, routine, arriveAt, now);
  if (plan === undefined) return { state: { ...state, checkedAt: now } };

  const seen: RoutineState = { ...state, checkedAt: now, key: plan.key, leaveAt: plan.leaveAt };
  const send = (
    stage: RoutineState["stage"],
    title: string,
    body: string,
    updates = state?.updates ?? 0
  ): Decision => ({
    state: { ...seen, stage, updates },
    message: { title, body, tag: routineTag(routine), url: "/tragitto" },
    expiresAt: plan.leaveAt + 5 * MIN,
  });
  const leave = shortTime(plan.leaveAt);

  if (now >= plan.leaveAt - NOW_LEAD_MS) {
    return send("now", "Esci ora", details(plan, routine, true));
  }
  if (state?.stage === undefined) {
    if (now < plan.leaveAt - FIRST_LEAD_MS) return { state: seen };
    return send("first", `Esci alle ${leave} per ${busOf(plan)}`, details(plan, routine, false));
  }

  // The first notice was sent: only changes are worth another one
  const updates = (state.updates ?? 0) + 1;
  if (updates > MAX_UPDATES) return { state: { ...state, checkedAt: now } };
  if (plan.key !== state.key) {
    const reason = changeReason(state.key, connections, arriveAt);
    return send("first", `${reason}: esci alle ${leave}`, details(plan, routine, true), updates);
  }
  if (state.leaveAt !== undefined && Math.abs(plan.leaveAt - state.leaveAt) >= UPDATE_MS) {
    const line = capitalize(theLine(plan.connection.legs[0].line));
    const delay = delayMinutesOf(plan);
    const reason =
      delay > 0
        ? `${line} ha ${delay} min di ritardo`
        : delay < 0
          ? `${line} è in anticipo`
          : `${line} è di nuovo in orario`;
    return send("first", `${reason}: esci alle ${leave}`, details(plan, routine, false), updates);
  }
  // Small changes: keep the times of the last message to compare with
  return { state: { ...state, checkedAt: now } };
}

// "lun-ven", "sab, dom", "tutti i giorni"
export function formatDays(days: ReadonlyArray<number>): string {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 7) return "tutti i giorni";
  const consecutive = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (sorted.length >= 3 && consecutive) {
    return `${WEEKDAYS[sorted[0] - 1]}-${WEEKDAYS[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((day) => WEEKDAYS[day - 1]).join(", ");
}
