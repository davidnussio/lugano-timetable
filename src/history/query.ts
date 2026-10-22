// Questions to the history of the trips: how late the 6 leaves Via Brentani
// when it snows, how long the wait is on Saturday mornings. Kept free of
// browser APIs.

import type { WeatherKind } from "~/timer/plan";
import { type DayType, percentile, zurichTime } from "~/timetable/reliability";
import type { RideRecord, TripRecord } from "./trip";

// "dry": weather known, nothing falling; "wet": any rain, snow or ice
export type WeatherFilter = "dry" | "wet" | WeatherKind;

export type TimeOfDay = "night" | "morning" | "day" | "evening" | "late";

// Hours of Lugano from which each part of the day starts: the rush hours of
// the morning and of the evening apart
const TIMES_OF_DAY: ReadonlyArray<readonly [TimeOfDay, number]> = [
  ["night", 0],
  ["morning", 6],
  ["day", 9],
  ["evening", 16],
  ["late", 19],
];

export function timeOfDay(hour: number): TimeOfDay {
  let part: TimeOfDay = "night";
  for (const [name, from] of TIMES_OF_DAY) if (hour >= from) part = name;
  return part;
}

export interface HistoryFilter {
  readonly line?: string;
  // Where the user got on, as recorded
  readonly stop?: string;
  readonly weather?: WeatherFilter;
  readonly day?: DayType;
  readonly time?: TimeOfDay;
}

export type TripWeatherKind = "dry" | WeatherKind;

// Undefined when the weather was not known
export function weatherOf(trip: TripRecord): TripWeatherKind | undefined {
  return trip.weather === undefined ? undefined : (trip.weather.kind ?? "dry");
}

function matchesWeather(trip: TripRecord, filter: WeatherFilter): boolean {
  const kind = weatherOf(trip);
  if (kind === undefined) return false;
  if (filter === "wet") return kind !== "dry";
  return kind === filter;
}

// Delays beyond these are a wrong match (another run) rather than a delay,
// as for the reliability of the server
const MIN_DELAY_MS = -10 * 60_000;
const MAX_DELAY_MS = 60 * 60_000;

// Late (or early) at the departure, when both times are known
export function departureDelay(ride: RideRecord): number | undefined {
  const { scheduled, actual } = ride.departure;
  if (scheduled === undefined || actual === undefined) return undefined;
  const delay = actual - scheduled;
  return delay < MIN_DELAY_MS || delay > MAX_DELAY_MS ? undefined : delay;
}

export interface RideSample {
  readonly trip: TripRecord;
  readonly ride: RideRecord;
  // Hour of Lugano when the bus left
  readonly hour: number;
  readonly delayMs?: number;
}

// Every ride of the history matching the filter, oldest first
export function rideSamples(
  history: ReadonlyArray<TripRecord>,
  filter: HistoryFilter = {}
): ReadonlyArray<RideSample> {
  const samples: RideSample[] = [];
  for (const trip of history) {
    if (filter.weather !== undefined && !matchesWeather(trip, filter.weather)) continue;
    if (filter.day !== undefined && trip.dayType !== filter.day) continue;
    for (const ride of trip.rides) {
      if (filter.line !== undefined && ride.line !== filter.line) continue;
      if (filter.stop !== undefined && ride.from !== filter.stop) continue;
      const leftAt = ride.departure.actual ?? ride.departure.scheduled;
      const hour = leftAt === undefined ? trip.hour : Math.floor(zurichTime(leftAt).ms / 3_600_000);
      if (filter.time !== undefined && timeOfDay(hour) !== filter.time) continue;
      const delayMs = departureDelay(ride);
      samples.push({ trip, ride, hour, ...(delayMs === undefined ? {} : { delayMs }) });
    }
  }
  return samples;
}

// A bus leaving later than this is counted as late, as for the reliability
const LATE_MS = 2 * 60_000;
// Within this the bus counts as on time
const ON_TIME_MS = 60_000;

export interface DelaySummary {
  readonly rides: number;
  // Rides with a delay known: the ones followed with real-time data
  readonly measured: number;
  // Milliseconds, absent without a delay known
  readonly mean?: number;
  readonly median?: number;
  readonly p80?: number;
  readonly max?: number;
  readonly lateShare?: number;
  readonly onTimeShare?: number;
}

export function delaySummary(samples: ReadonlyArray<RideSample>): DelaySummary {
  const delays = samples
    .map((sample) => sample.delayMs)
    .filter((delay) => delay !== undefined)
    .sort((a, b) => a - b);
  if (delays.length === 0) return { rides: samples.length, measured: 0 };
  return {
    rides: samples.length,
    measured: delays.length,
    mean: delays.reduce((sum, delay) => sum + delay, 0) / delays.length,
    median: percentile(delays, 0.5),
    p80: percentile(delays, 0.8),
    max: delays.at(-1),
    lateShare: delays.filter((delay) => delay > LATE_MS).length / delays.length,
    onTimeShare: delays.filter((delay) => Math.abs(delay) <= ON_TIME_MS).length / delays.length,
  };
}

export interface Group<K> {
  readonly key: K;
  readonly summary: DelaySummary;
}

// The delays by weather, by day, by hour…: the groups in the order of `keys`,
// the empty ones left out
export function groupBy<K>(
  samples: ReadonlyArray<RideSample>,
  keys: ReadonlyArray<K>,
  keyOf: (sample: RideSample) => K | undefined
): ReadonlyArray<Group<K>> {
  return keys.flatMap((key) => {
    const group = samples.filter((sample) => keyOf(sample) === key);
    return group.length === 0 ? [] : [{ key, summary: delaySummary(group) }];
  });
}

// The trips with a ride among the samples, latest first
export function sampleTrips(samples: ReadonlyArray<RideSample>): ReadonlyArray<TripRecord> {
  const trips = new Map<number, TripRecord>();
  for (const { trip } of samples) trips.set(trip.id, trip);
  return [...trips.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export interface HistoryTotals {
  readonly trips: number;
  readonly rides: number;
  // On board, from the departures to the arrivals known
  readonly rideMs: number;
  readonly walkMeters: number;
  readonly waitMs: number;
  readonly doorToDoorMs: number;
}

export function historyTotals(trips: ReadonlyArray<TripRecord>): HistoryTotals {
  let rides = 0;
  let rideMs = 0;
  let walkMeters = 0;
  let waitMs = 0;
  let doorToDoorMs = 0;
  for (const trip of trips) {
    rides += trip.rides.length;
    for (const ride of trip.rides) {
      const from = ride.departure.actual ?? ride.departure.scheduled;
      const to = ride.arrival?.actual ?? ride.arrival?.scheduled;
      if (from !== undefined && to !== undefined && to > from) rideMs += to - from;
    }
    walkMeters += trip.walk?.meters ?? 0;
    waitMs += trip.waitMs ?? 0;
    doorToDoorMs += trip.durationMs;
  }
  return { trips: trips.length, rides, rideMs, walkMeters, waitMs, doorToDoorMs };
}

// The values to choose from, the most frequent first
export function choices(values: Iterable<string>): ReadonlyArray<string> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it", { numeric: true }))
    .map(([value]) => value);
}
