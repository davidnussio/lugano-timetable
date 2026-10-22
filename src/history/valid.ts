// Checks of the history read back from localStorage: a trip saved by an
// older version of the app, or corrupted, is dropped alone, not the whole
// history.
import type { RideRecord, TripRecord, TripTime, TripWeather } from "./trip";

type Shape = Record<string, unknown>;

const isObject = (value: unknown): value is Shape =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isOptional = <A>(value: unknown, check: (value: unknown) => value is A) =>
  value === undefined || check(value);

const isWeatherKind = (value: unknown) =>
  value === "ice" || value === "snow" || value === "heavyRain" || value === "rain";

export const isTripWeather = (value: unknown): value is TripWeather =>
  isObject(value) &&
  isNumber(value.precipitation) &&
  isNumber(value.snowfall) &&
  isNumber(value.code) &&
  (value.kind === undefined || isWeatherKind(value.kind));

const isTripTime = (value: unknown): value is TripTime =>
  isObject(value) && isOptional(value.scheduled, isNumber) && isOptional(value.actual, isNumber);

const isRide = (value: unknown): value is RideRecord =>
  isObject(value) &&
  isString(value.line) &&
  isOptional(value.category, isString) &&
  isOptional(value.operator, isString) &&
  isString(value.destination) &&
  isString(value.from) &&
  isOptional(value.to, isString) &&
  isTripTime(value.departure) &&
  isOptional(value.arrival, isTripTime);

const isWalk = (value: unknown): value is Shape =>
  isObject(value) &&
  isNumber(value.leftAt) &&
  isNumber(value.ms) &&
  isOptional(value.meters, isNumber);

export function isTripRecord(value: unknown): value is TripRecord {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    (value.kind === "bus" || value.kind === "journey" || value.kind === "onBoard") &&
    isNumber(value.startedAt) &&
    isNumber(value.endedAt) &&
    typeof value.completed === "boolean" &&
    isString(value.date) &&
    (value.dayType === "weekday" || value.dayType === "saturday" || value.dayType === "sunday") &&
    typeof value.holiday === "boolean" &&
    isNumber(value.hour) &&
    isString(value.from) &&
    isString(value.to) &&
    Array.isArray(value.rides) &&
    value.rides.length > 0 &&
    value.rides.every(isRide) &&
    isOptional(value.walk, isWalk) &&
    isOptional(value.waitMs, isNumber) &&
    isOptional(value.walkAfterMs, isNumber) &&
    isNumber(value.durationMs) &&
    isOptional(value.weather, isTripWeather) &&
    (value.pace === "slow" || value.pace === "normal" || value.pace === "fast") &&
    isNumber(value.alerts)
  );
}

// The trips of another shape dropped: the others are kept
export function validTrips(value: unknown): ReadonlyArray<TripRecord> {
  return Array.isArray(value) ? value.filter(isTripRecord) : [];
}
