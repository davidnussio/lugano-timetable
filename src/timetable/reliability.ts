// How late a departure usually leaves, learned from the real-time data the
// server already fetches: the delay of every bus about to leave is kept, one
// value per day, for the same stop, line, direction and timetable time.
import type { Departure } from "./models";

// Days a delay is kept: about two months of the same timetable
export const WINDOW_DAYS = 60;
// One sample per day: a cap within the window, in case of a clock gone wrong
export const MAX_SAMPLES = 60;
// Only a bus this close to leaving: its estimate is the most accurate, and
// the latest one of the day wins
export const RECORD_WITHIN_S = 120;
// Delays beyond these are a wrong match (another run) rather than a delay
const MIN_DELAY_S = -10 * 60;
const MAX_DELAY_S = 60 * 60;
// A bus leaving later than this is counted as late
export const LATE_S = 120;

// Timetables differ between weekdays, Saturdays and Sundays
export type DayType = "weekday" | "saturday" | "sunday";

export interface DelaySample {
  // Day of the timetable, in Lugano: "2026-10-16"
  readonly date: string;
  // Seconds after the timetable time, negative when early
  readonly delay: number;
}

export interface DelayStats {
  readonly samples: number;
  // Seconds: absent without samples
  readonly median?: number;
  readonly p80?: number;
  // Share of the days the bus left more than two minutes late
  readonly lateShare?: number;
}

const ZURICH = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Zurich",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

interface LocalTime {
  readonly date: string;
  readonly weekday: string;
  // Milliseconds since the local midnight
  readonly ms: number;
  // Local time minus UTC
  readonly offset: number;
}

// The clock of Lugano at `at`, whatever the time zone of the server
function zurichTime(at: number): LocalTime {
  const parts = Object.fromEntries(
    ZURICH.formatToParts(at).map((part) => [part.type, part.value])
  );
  const [year, month, day] = [parts.year, parts.month, parts.day].map(Number);
  const ms =
    ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 +
    (((at % 1000) + 1000) % 1000);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    ms,
    offset: Date.UTC(year, month - 1, day) + ms - at,
  };
}

export function dayType(weekday: string): DayType {
  return weekday === "Sat" ? "saturday" : weekday === "Sun" ? "sunday" : "weekday";
}

const clockMs = (time: string): number | undefined => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (match === null) return undefined;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? (hours * 60 + minutes) * 60_000 : undefined;
};

const DAY_MS = 24 * 60 * 60_000;

// The instant at which Lugano clocks show `time` ("HH:MM" of the RTPI
// server) closest to `at`: 23:58 for a bus expected at 00:03 is the evening
// before. Undefined for a malformed time.
export function scheduledInstant(time: string, at: number): number | undefined {
  const clock = clockMs(time);
  if (clock === undefined) return undefined;
  const local = zurichTime(at);
  let diff = clock - local.ms;
  if (diff < -DAY_MS / 2) diff += DAY_MS;
  if (diff > DAY_MS / 2) diff -= DAY_MS;
  const candidate = at + diff;
  // Across a change of daylight saving time the offset moves by an hour
  return candidate + local.offset - zurichTime(candidate).offset;
}

// The day of the timetable of `time` around `at`, and its type
export function serviceDay(
  time: string,
  at: number
): { readonly date: string; readonly dayType: DayType } | undefined {
  const scheduled = scheduledInstant(time, at);
  if (scheduled === undefined) return undefined;
  const local = zurichTime(scheduled);
  return { date: local.date, dayType: dayType(local.weekday) };
}

export interface DepartureKey {
  readonly target: string;
  readonly route: string;
  readonly dir: string;
  readonly time: string;
}

// Same platform, line, direction, timetable time and type of day
export function delayKey(key: DepartureKey, day: DayType): string {
  return `${day}:${key.target}:${key.route}:${key.dir}:${key.time}`;
}

export interface Observation {
  readonly key: string;
  readonly sample: DelaySample;
}

// The delay of a departure about to leave, undefined for the others: farther
// away the estimate is still the timetable, or it has no estimate at all
export function observeDelay(
  departure: Departure,
  now: number
): Observation | undefined {
  const { DepartureAt } = departure;
  if (DepartureAt === undefined) return undefined;
  if (DepartureAt - now > RECORD_WITHIN_S * 1000 || DepartureAt < now - 60_000) {
    return undefined;
  }
  const scheduled = scheduledInstant(departure.Time, DepartureAt);
  if (scheduled === undefined) return undefined;
  const delay = Math.round((DepartureAt - scheduled) / 1000);
  if (delay < MIN_DELAY_S || delay > MAX_DELAY_S) return undefined;
  const day = serviceDay(departure.Time, DepartureAt);
  if (day === undefined) return undefined;
  return {
    key: delayKey(
      {
        target: departure.Target,
        route: departure.Route,
        dir: departure.Dir,
        time: departure.Time,
      },
      day.dayType
    ),
    sample: { date: day.date, delay },
  };
}

// "2026-10-16" minus `days`
function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

// The samples within the window ending on `today`, oldest first
export function recentSamples(
  samples: ReadonlyArray<DelaySample>,
  today: string
): ReadonlyArray<DelaySample> {
  const since = daysBefore(today, WINDOW_DAYS);
  return samples
    .filter((sample) => sample.date > since && sample.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SAMPLES);
}

// The samples with the one of its day replaced: the latest observation wins
export function addSample(
  samples: ReadonlyArray<DelaySample>,
  sample: DelaySample
): ReadonlyArray<DelaySample> {
  return recentSamples(
    [...samples.filter((other) => other.date !== sample.date), sample],
    sample.date
  );
}

// Nearest rank: always one of the delays seen, and with few samples the
// higher one rather than an average that never happened
export function percentile(sorted: ReadonlyArray<number>, p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function delayStats(samples: ReadonlyArray<DelaySample>): DelayStats {
  const delays = samples.map((sample) => sample.delay).sort((a, b) => a - b);
  if (delays.length === 0) return { samples: 0 };
  return {
    samples: delays.length,
    median: percentile(delays, 0.5),
    p80: percentile(delays, 0.8),
    lateShare: delays.filter((delay) => delay > LATE_S).length / delays.length,
  };
}

// Valid samples read back from storage, the others dropped
export function isDelaySample(value: unknown): value is DelaySample {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DelaySample).date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test((value as DelaySample).date) &&
    typeof (value as DelaySample).delay === "number" &&
    Number.isFinite((value as DelaySample).delay)
  );
}
