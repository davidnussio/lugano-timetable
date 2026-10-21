// When a journey is searched for: leaving now, or leaving at or arriving by
// a time of the coming week, in Lugano whatever the time zone of the device
import { expected } from "~/timer/journey";
import type { Connection } from "./models";

export interface SearchTime {
  // Days after today, up to a week
  readonly day: number;
  // "08:00": now when missing, or the time of the day chosen
  readonly time?: string;
  // Arriving by the time rather than leaving at it
  readonly arrive: boolean;
}

export const NOW: SearchTime = { day: 0, arrive: false };

// Today and the six days after it
export const SEARCH_DAYS = 7;

const zurich = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

// The clock of Lugano at `ms`, read as if it were UTC
function wallClock(ms: number): number {
  const parts = Object.fromEntries(
    zurich.formatToParts(ms).map((part) => [part.type, Number(part.value)])
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

// "08:00" in Lugano, `day` days after the one of `now`, as milliseconds.
// Undefined for anything else than a time.
export function zurichAt(day: number, time: string, now: number): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (match === null) return undefined;
  const today = new Date(wallClock(now));
  const wall = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + day,
    Number(match[1]),
    Number(match[2])
  );
  // The wall clock less the offset of Lugano then: once more across a
  // change of the clocks
  let at = wall;
  for (let i = 0; i < 2; i++) at += wall - wallClock(at);
  return at;
}

// "08:00" in Lugano
export function zurichTime(ms: number): string {
  const clock = new Date(wallClock(ms));
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
}

// The time of the search in milliseconds: undefined for now
export function searchAt({ day, time }: SearchTime, now: number): number | undefined {
  if (time === undefined) return day === 0 ? undefined : zurichAt(day, zurichTime(now), now);
  return zurichAt(day, time, now);
}

// A time worth arriving by when none was chosen: the next quarter of an hour
// at least an hour from now
export function arrivalTime(now: number): string {
  const quarter = 15 * 60_000;
  return zurichTime(Math.ceil((now + 60 * 60_000) / quarter) * quarter);
}

// Arriving by a time, how early is still worth it
const EARLIEST_ARRIVAL_MS = 60 * 60_000;

// The connections arriving by `at` at most an hour before it, or else the
// one arriving last: the latest way to get there when none is that close
export function arrivingBy(
  connections: ReadonlyArray<Connection>,
  at: number
): ReadonlyArray<Connection> {
  const arrival = ({ legs, walkAfterMs }: Connection) =>
    expected(legs[legs.length - 1].arrival) + (walkAfterMs ?? 0);
  const close = connections.filter((c) => arrival(c) >= at - EARLIEST_ARRIVAL_MS);
  if (close.length > 0 || connections.length === 0) return close;
  const last = connections.reduce((a, b) => (arrival(b) > arrival(a) ? b : a));
  return [last];
}
