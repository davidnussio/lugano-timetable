// Checks of the timer and of the favorite rides read back from localStorage:
// a value saved by an older version of the app, or corrupted, must not reach
// the components.
import { isTripWeather } from "~/history/valid";
import type { GetOffAlert } from "./get-off";
import type { LearnedPace } from "./pace";
import type { FavoriteRide } from "./rides";
import type { ActiveTimer } from "./store";

type Shape = Record<string, unknown>;

const isObject = (value: unknown): value is Shape =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isArrayOf = <A>(value: unknown, item: (value: unknown) => value is A): value is A[] =>
  Array.isArray(value) && value.every(item);
const isOptional = <A>(value: unknown, check: (value: unknown) => value is A) =>
  value === undefined || check(value);

const isPosition = (value: unknown): value is Shape =>
  isObject(value) && isNumber(value.lat) && isNumber(value.lon);

const isTiming = (value: unknown): value is Shape =>
  isObject(value) && isNumber(value.scheduled) && isOptional(value.estimated, isNumber);

const isNamed = (value: unknown): value is Shape =>
  isObject(value) && isString(value.name) && isOptional(value.position, isPosition);

const isLeg = (value: unknown): value is Shape =>
  isObject(value) &&
  isString(value.trip) &&
  isString(value.line) &&
  isString(value.destination) &&
  isNamed(value.from) &&
  isNamed(value.to) &&
  isTiming(value.departure) &&
  isTiming(value.arrival) &&
  isOptional(value.walkBeforeMs, isNumber);

const isJourney = (value: unknown): value is Shape =>
  isObject(value) &&
  isNamed(value.from) &&
  isNamed(value.to) &&
  isArrayOf(value.legs, isLeg) &&
  value.legs.length > 0 &&
  isOptional(value.walkAfterMs, isNumber) &&
  isArrayOf(value.alerted, isString);

const isGetOffAlert = (value: unknown): value is GetOffAlert =>
  value === "next" || value === "now";

// The stop to get off: added later, absent from the timers of before
const isGetOff = (value: unknown): value is Shape =>
  isObject(value) &&
  isString(value.target) &&
  isString(value.name) &&
  isOptional(value.position, isPosition) &&
  isOptional(value.arrivalAt, isNumber) &&
  isOptional(value.left, isBoolean) &&
  isOptional(value.arrivedAt, isNumber) &&
  isArrayOf(value.alerted, isGetOffAlert);

const isStop = (value: unknown): value is Shape =>
  isObject(value) &&
  isString(value.name) &&
  isString(value.label) &&
  isArrayOf(value.identifiers, isString);

const isPace = (value: unknown) => value === "slow" || value === "normal" || value === "fast";

const isWalk = (value: unknown): value is Shape =>
  isObject(value) &&
  isNumber(value.at) &&
  isNumber(value.meters) &&
  isOptional(value.climb, isNumber) &&
  isPace(value.pace) &&
  isNumber(value.lastAt) &&
  isOptional(value.spoiled, (spoiled) => typeof spoiled === "boolean");

const isAtStop = (value: unknown): value is Shape =>
  isObject(value) &&
  isNumber(value.at) &&
  isOptional(value.leftAt, isNumber) &&
  isOptional(value.meters, isNumber);

export function isActiveTimer(value: unknown): value is ActiveTimer {
  return (
    isObject(value) &&
    isStop(value.stop) &&
    isString(value.target) &&
    isOptional(value.coordinates, isPosition) &&
    isString(value.line) &&
    isString(value.route) &&
    isString(value.dir) &&
    isString(value.routing) &&
    isString(value.img) &&
    isString(value.destination) &&
    isOptional(value.uid, isNumber) &&
    isString(value.time) &&
    isNumber(value.departureAt) &&
    isNumber(value.startedAt) &&
    isArrayOf(value.thresholds, isNumber) &&
    isArrayOf(value.fired, isNumber) &&
    typeof value.plannedWithWalk === "boolean" &&
    isOptional(value.journey, isJourney) &&
    isOptional(value.approach, isObject) &&
    isOptional(value.walk, isWalk) &&
    isOptional(value.atStop, isAtStop) &&
    isOptional(value.getOff, isGetOff) &&
    isOptional(value.weather, isTripWeather)
  );
}

export const isStoredTimer = (value: unknown): value is ActiveTimer | null =>
  value === null || isActiveTimer(value);

const isHistogram = (value: unknown): value is number[] =>
  isArrayOf(value, isNumber) && value.length === 24;

export function isFavoriteRide(value: unknown): value is FavoriteRide {
  return (
    isObject(value) &&
    isStop(value.stop) &&
    isString(value.route) &&
    isString(value.line) &&
    isString(value.img) &&
    isString(value.dir) &&
    isString(value.destination) &&
    isHistogram(value.hours)
  );
}

export const isStoredRides = (value: unknown): value is FavoriteRide[] =>
  isArrayOf(value, isFavoriteRide);

export function isLearnedPace(value: unknown): value is LearnedPace {
  return isObject(value) && isArrayOf(value.speeds, isNumber) && isNumber(value.count);
}
