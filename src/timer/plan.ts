// Pure logic behind the departure timer: how long it takes to walk to the
// stop, when to leave and when to alert. Kept free of browser APIs so that it
// can be unit tested.

import type { Messages } from "~/i18n/messages";
import type { CurrentWeather } from "~/weather/open-meteo-client";

export interface Position {
  readonly lat: number;
  readonly lon: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

// Great-circle distance between two WGS84 positions
export function distanceMeters(a: Position, b: Position): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export type Pace = "slow" | "normal" | "fast";

// Walking speeds in meters per second, until the pace of the user is
// learned from the walks to the stop (see `pace.ts`)
export const PACE_SPEED: Record<Pace, number> = {
  slow: 1.0,
  normal: 1.3,
  fast: 1.7,
};

// Streets are never a straight line, especially on Lugano's hills
const DETOUR_FACTOR = 1.35;

// Steepest mean slope counted: a few meters of error of the heights over a
// short walk would make it a wall
const MAX_GRADE = 0.25;

// How much longer a walk of `meters` as the crow flies takes going up
// `climb` meters: uphill the pace slows down as in Tobler's hiking function,
// by e^(3.5 × slope) on the way of the streets. Downhill is left as on the
// flat.
export function climbFactor(meters: number, climb: number): number {
  const path = meters * DETOUR_FACTOR;
  const grade = path > 0 ? Math.min(MAX_GRADE, Math.max(0, climb) / path) : 0;
  return Math.exp(3.5 * grade);
}

// At `speed` meters per second on the flat. With `climb`, the meters to go
// up to the stop.
export function walkingSeconds(
  meters: number,
  speed = PACE_SPEED.normal,
  climb = 0
): number {
  return ((meters * DETOUR_FACTOR) / speed) * climbFactor(meters, climb);
}

// What slows down the walk
export type WeatherKind = "ice" | "snow" | "heavyRain" | "rain";

export interface WeatherWalk {
  // How much longer the walk takes
  readonly factor: number;
  // What slows it down, undefined when dry
  readonly kind?: WeatherKind;
}

const DRY: WeatherWalk = { factor: 1 };

// Below this a drizzle does not change the walk; from the second a downpour
// (WMO "heavy" rain), in millimeters per hour
const RAIN_MM_PER_HOUR = 0.3;
const HEAVY_RAIN_MM_PER_HOUR = 4;

// WMO weather codes: rain, rain showers and thunderstorms; their heavy kinds;
// snow, snow grains and snow showers; freezing drizzle and freezing rain
const RAIN_CODES = new Set([61, 63, 65, 80, 81, 82, 95, 96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const ICE_CODES = new Set([56, 57, 66, 67]);

// How the weather now slows down the walk. Wet stairs and steep sidewalks,
// the umbrella in the crowd and the puddles at the crossings make it about
// 10% longer in the rain, 15% under a downpour. Snow and ice are slippery
// like a winter hike: about 30% longer, the same for both.
export function weatherWalk(weather: CurrentWeather | undefined): WeatherWalk {
  if (weather === undefined) return DRY;
  const { precipitation, snowfall, code } = weather;
  if (ICE_CODES.has(code)) return { factor: 1.3, kind: "ice" };
  if (snowfall > 0 || SNOW_CODES.has(code)) return { factor: 1.3, kind: "snow" };
  if (precipitation >= HEAVY_RAIN_MM_PER_HOUR || HEAVY_RAIN_CODES.has(code)) {
    return { factor: 1.15, kind: "heavyRain" };
  }
  if (precipitation >= RAIN_MM_PER_HOUR || RAIN_CODES.has(code)) {
    return { factor: 1.1, kind: "rain" };
  }
  return DRY;
}

export interface WeatherDelay {
  readonly kind: WeatherKind;
  readonly minutes: number;
}

// The minutes the weather adds to a walk of `seconds` (already slowed down
// by it): worth telling from one minute up
export function weatherDelay(
  seconds: number,
  { factor, kind }: WeatherWalk
): WeatherDelay | undefined {
  if (kind === undefined) return undefined;
  const minutes = Math.round((seconds - seconds / factor) / 60);
  return minutes >= 1 ? { kind, minutes } : undefined;
}

// Meters per second by which the distance shrinks when the walking time drops
// by one second per second: the release of `peakHold` for the distance
export function walkingRelease(speed = PACE_SPEED.normal): number {
  return speed / DETOUR_FACTOR;
}

export interface Fix extends Position {
  // Radius in meters within which the position is likely to be
  readonly accuracy: number;
  // When the position was measured, in milliseconds
  readonly at: number;
}

// Fixes less precise than this (cell towers, Wi-Fi) are too rough for the
// walk to the stop: the last precise one is kept instead
const RELIABLE_ACCURACY_METERS = 100;
// A fix cached by the browser can be a little older than the timer
const FIX_GRACE_MS = 60_000;

// Whether a fix can tell the walk of a timer started at `since`: precise
// enough, and not left over from before the timer (e.g. from the morning)
export function reliableFix(
  { accuracy, at }: Pick<Fix, "accuracy" | "at">,
  since: number
): boolean {
  return accuracy <= RELIABLE_ACCURACY_METERS && at >= since - FIX_GRACE_MS;
}

// Farther than this from the stop (about 45 minutes on foot) the user is not
// walking there: on another bus, a train or in another town
const FAR_METERS = 2_500;

export function isFar(meters: number): boolean {
  return meters > FAR_METERS;
}

export interface Envelope {
  readonly value: number;
  // When `value` was measured, in milliseconds
  readonly at: number;
}

// The distance to the stop follows the GPS, whose position jumps by a few
// meters at every fix. Like the level meter of an amplifier, the estimate
// rises quickly (better to leave early) and falls slowly:
// - it rises towards a higher value with an `attack` time constant in
//   seconds, so a jump speeds the countdown up for a few seconds instead of
//   skipping it ahead (63% of the way after `attack`, 95% after 3 times it);
// - it falls by at most `release` per second. With `walkingRelease` the
//   walking time drops by at most one second per second, so the time to
//   leave never goes back up: noise only pauses the countdown, and it stays
//   still while walking to the stop.
export function peakHold(
  previous: Envelope | undefined,
  value: number,
  at: number,
  release = 1,
  attack = 3
): Envelope {
  if (previous === undefined) return { value, at };
  const elapsed = (at - previous.at) / 1000;
  if (value > previous.value) {
    const rise = attack > 0 ? 1 - Math.exp(-elapsed / attack) : 1;
    return { value: previous.value + (value - previous.value) * rise, at };
  }
  return { value: Math.max(value, previous.value - release * elapsed), at };
}

// Where the user is on the way to the stop:
// - "away": not left yet, the countdown is the time to leave;
// - "walking": on the way, the countdown is the walk left;
// - "arrived": at the stop, the countdown is the bus.
// It only moves forward, so that the GPS noise never sends the user back home.
export type Stage = "away" | "walking" | "arrived";

export interface Approach {
  readonly stage: Stage;
  // The farthest reliable distance from the stop seen so far
  readonly farthest?: { readonly meters: number; readonly accuracy: number };
}

// Fixes less precise than this (indoors, cell towers) are ignored
const MAX_ACCURACY_METERS = 50;
// The user counts as on the way after getting this much closer to the stop,
// or more when the fixes are not precise enough to tell
const MIN_PROGRESS_METERS = 25;
const ARRIVED_METERS = 30;

export function isPrecise(accuracy: number): boolean {
  return accuracy <= MAX_ACCURACY_METERS;
}

// Whether a fix `meters` from the stop within `accuracy` is closer than the
// farthest one by more than the two can be wrong together
export function closerThan(
  farthest: NonNullable<Approach["farthest"]>,
  meters: number,
  accuracy: number
): boolean {
  return farthest.meters - meters > Math.max(MIN_PROGRESS_METERS, farthest.accuracy + accuracy);
}

// Moves the stage forward with a GPS fix: `meters` from the stop, measured
// within `accuracy` meters. Returns `previous` itself when nothing changes.
// Far from the stop, getting closer is riding towards it, not walking.
export function approach(
  previous: Approach | undefined,
  meters: number,
  accuracy: number
): Approach {
  const stage = previous?.stage ?? "away";
  if (stage === "arrived" || !isPrecise(accuracy) || isFar(meters)) {
    return previous ?? { stage };
  }
  if (meters <= ARRIVED_METERS) return { stage: "arrived" };

  const farthest =
    previous?.farthest && previous.farthest.meters >= meters
      ? previous.farthest
      : { meters, accuracy };
  const next = closerThan(farthest, meters, accuracy) ? "walking" : stage;
  return previous && next === stage && farthest === previous.farthest
    ? previous
    : { stage: next, farthest };
}

// How the walk to the stop is known: from the timetable of a journey, or
// measured with the GPS (better)
export type WalkSource = "timetable" | "gps";

// Remaining minutes at which to alert, in descending order. Each alert comes
// after 40% of the remaining time has elapsed, so a 20 minute wait gives
// 12, 7, 4, 3, 2, 1, 0 instead of an alert every minute. 0 is "leave now".
export function alertThresholds(minutes: number, ratio = 0.6): number[] {
  const thresholds: number[] = [];
  let next = minutes * ratio;
  while (next >= 1) {
    const rounded = Math.round(next);
    if (rounded < minutes && !thresholds.includes(rounded)) {
      thresholds.push(rounded);
    }
    next *= ratio;
  }
  if (minutes > 1 && !thresholds.includes(1)) thresholds.push(1);
  thresholds.push(0);
  return thresholds;
}

// The alert to show now, if any: the smallest threshold already reached that
// has not been fired yet. Older thresholds reached at the same time (e.g.
// after the phone was asleep) are skipped, so only one alert is shown.
export function dueAlert(
  thresholds: ReadonlyArray<number>,
  fired: ReadonlyArray<number>,
  remainingMinutes: number
): number | undefined {
  const reached = thresholds.filter(
    (threshold) => remainingMinutes <= threshold
  );
  const smallest = reached.at(-1);
  if (smallest === undefined || fired.includes(smallest)) return undefined;
  return fired.some((threshold) => threshold < smallest) ? undefined : smallest;
}

export interface Countdown {
  // Until the bus leaves the stop
  readonly departureMs: number;
  // Until the user has to leave to catch it: negative when late. Equal to
  // `departureMs` when the walking time is not known.
  readonly leaveMs: number;
  readonly walkingMs: number | undefined;
}

export function countdown(
  departureAt: number,
  now: number,
  walkSeconds: number | undefined
): Countdown {
  const departureMs = departureAt - now;
  const walkingMs = walkSeconds === undefined ? undefined : walkSeconds * 1000;
  return {
    departureMs,
    leaveMs: departureMs - (walkingMs ?? 0),
    walkingMs,
  };
}

// Minutes shown to the user, rounded up so that an alert fired when 3
// minutes are left reads "3 min" (and 30 seconds read "1 min")
export function minutesLeft(ms: number): number {
  return Math.ceil(ms / 60_000) || 0;
}

export interface AlertMessage {
  readonly title: string;
  readonly body: string;
}

// With `weather`, what slows down the walk
export function alertMessage(
  m: Messages,
  line: string,
  destination: string,
  { departureMs, leaveMs, walkingMs }: Countdown,
  weather?: WeatherKind
): AlertMessage {
  const bus = m.alerts.bus(line, destination);
  const departs = minutesLeft(departureMs);

  if (walkingMs === undefined) {
    return { title: m.alerts.busDeparts(departs), body: bus };
  }

  const leave = minutesLeft(leaveMs);
  const walk = Math.max(1, Math.round(walkingMs / 60_000));
  const onFoot = m.alerts.onFoot(walk, weather && m.weatherInline[weather]);
  const departsIn = m.alerts.busDepartsInline(departs);
  if (leave > 0) {
    return { title: m.alerts.leaveIn(leave), body: `${bus} · ${departsIn}, ${onFoot}` };
  }
  if (leave === 0) {
    return { title: m.alerts.leaveNow, body: `${bus} · ${departsIn}, ${onFoot}` };
  }
  return { title: m.alerts.late(-leave), body: `${bus} · ${departsIn}` };
}
