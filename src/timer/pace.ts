// The walking pace of the user, learned from the walks to the stop followed
// with the GPS. Like `plan.ts`, kept free of browser APIs.

import {
  type Approach,
  closerThan,
  isFar,
  isPrecise,
  PACE_SPEED,
  type Pace,
  walkingSeconds,
} from "./plan";

// A walk to the stop being measured, from when the user is on the way
export interface WalkTrack {
  // Its start: the last fix not yet closer to the stop than the farthest one
  // (see `approach`), in milliseconds and meters as the crow flies
  readonly at: number;
  readonly meters: number;
  // Meters to go up from there to the stop, once known
  readonly climb?: number;
  // The pace chosen at the start
  readonly pace: Pace;
  // When the latest precise fix of the walk was measured
  readonly lastAt: number;
  // Something else than a walk: a bus on the way, or the GPS lost too long
  readonly spoiled?: boolean;
}

export interface WalkReading {
  // From the stop, as the crow flies, within `accuracy` meters
  readonly meters: number;
  readonly accuracy: number;
  readonly at: number;
  readonly climb?: number;
  readonly pace: Pace;
}

// Without a fix this long, the user may have stopped on the way (or waited at
// the stop) unseen: the time of the walk is not known any more
const MAX_GAP_MS = 2 * 60_000;
// The climb of the start, when still unknown, is taken from a fix this close
// to it: the height of the user is snapped to about 20 m anyway
const START_CLIMB_METERS = 50;

const sameWalk = (a: WalkTrack, b: WalkTrack) =>
  a.at === b.at &&
  a.meters === b.meters &&
  a.climb === b.climb &&
  a.lastAt === b.lastAt &&
  a.spoiled === b.spoiled;

// Follows the walk with a fix, as `approach` moved from `before` to `after`.
// On the arrival at the stop it ends with the speed it measured, when
// plausible (see `walkSpeed`). Returns `previous` itself when nothing
// changes, so the same fix can be read again.
export function followWalk(
  previous: WalkTrack | undefined,
  before: Approach | undefined,
  after: Approach,
  reading: WalkReading
): { readonly walk: WalkTrack | undefined; readonly speed?: number } {
  const stage = before?.stage ?? "away";
  if (after.stage === "away") return { walk: undefined };
  if (after.stage === "arrived") {
    const speed = stage === "walking" && previous ? walkSpeed(previous, reading) : undefined;
    return speed === undefined ? { walk: undefined } : { walk: undefined, speed };
  }
  const { meters, accuracy, at, climb, pace } = reading;
  if (stage === "away") return { walk: { at, meters, climb, pace, lastAt: at } };
  // A walk not seen starting (an older timer) is not measured
  if (previous === undefined) return { walk: undefined };

  let next: WalkTrack;
  if (isFar(meters)) {
    next = { ...previous, spoiled: true };
  } else if (!isPrecise(accuracy)) {
    return { walk: previous };
  } else if (after.farthest && !closerThan(after.farthest, meters, accuracy)) {
    // Not on the way yet by the GPS: still at home after a jump of the fix,
    // or gone the other way. The walk starts again from here, whatever
    // happened before.
    next = { at, meters, climb: climb ?? previous.climb, pace: previous.pace, lastAt: at };
  } else {
    next = {
      ...previous,
      climb:
        previous.climb ?? (previous.meters - meters <= START_CLIMB_METERS ? climb : undefined),
      lastAt: at,
      ...(at - previous.lastAt > MAX_GAP_MS ? { spoiled: true } : {}),
    };
  }
  return { walk: sameWalk(next, previous) ? previous : next };
}

// Thresholds of a walk worth learning from: shorter ones are mostly the
// error of the GPS and the time to notice the start
const MIN_WALK_METERS = 150;
const MIN_WALK_SECONDS = 120;
// Model speeds of a walk: slower is a stop on the way, faster a bike or a car
const MIN_SPEED = 0.6;
const MAX_SPEED = 2.5;

// The flat speed in meters per second at which `walkingSeconds` takes
// `seconds` for `meters` as the crow flies going up `climb`: the detour of
// the streets and the slope are counted as when predicting the walk
export function modelSpeed(meters: number, climb: number, seconds: number): number {
  return walkingSeconds(meters, 1, climb) / seconds;
}

// The speed of a walk ended at the stop with `arrival`, as at the normal
// pace: undefined when not a plausible walk. The meters left at the arrival
// (the stop counts as reached within 30 m) are not walked.
export function walkSpeed(walk: WalkTrack, arrival: Pick<WalkReading, "meters" | "at" | "pace">): number | undefined {
  const meters = walk.meters - arrival.meters;
  const seconds = (arrival.at - walk.at) / 1000;
  if (
    walk.spoiled === true ||
    // Without the climb an uphill walk would look slow
    walk.climb === undefined ||
    // A change of pace on the way mixes two of them
    arrival.pace !== walk.pace ||
    arrival.at - walk.lastAt > MAX_GAP_MS ||
    meters < MIN_WALK_METERS ||
    seconds < MIN_WALK_SECONDS
  ) {
    return undefined;
  }
  const speed = modelSpeed(meters, walk.climb, seconds);
  if (speed < MIN_SPEED || speed > MAX_SPEED) return undefined;
  // Walking "di fretta" tells the fast pace: the normal one is slower
  return (speed * PACE_SPEED.normal) / PACE_SPEED[walk.pace];
}

// The latest speeds measured, as at the normal pace, and how many walks were
// measured in all
export interface LearnedPace {
  readonly speeds: ReadonlyArray<number>;
  readonly count: number;
}

export const NO_PACE: LearnedPace = { speeds: [], count: 0 };

// Walks kept: the pace follows the user over a few weeks
const KEPT_WALKS = 10;
// Walks needed before the learned pace replaces the default one
export const MIN_WALKS = 3;

export function learnPace(previous: LearnedPace, speed: number): LearnedPace {
  return {
    speeds: [...previous.speeds, speed].slice(-KEPT_WALKS),
    count: previous.count + 1,
  };
}

// The normal speed of the user once enough walks are measured: the median,
// so that a walk slowed down by a chat or a shop window does not count
export function learnedSpeed({ speeds }: LearnedPace): number | undefined {
  if (speeds.length < MIN_WALKS) return undefined;
  const sorted = [...speeds].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type PaceSpeeds = Readonly<Record<Pace, number>>;

// Walking speed of each pace in meters per second: the learned one for the
// normal pace, and the others with the same ratios as the default ones
export function paceSpeeds(learned: LearnedPace): PaceSpeeds {
  const normal = learnedSpeed(learned);
  if (normal === undefined) return PACE_SPEED;
  const scale = normal / PACE_SPEED.normal;
  return {
    slow: PACE_SPEED.slow * scale,
    normal,
    fast: PACE_SPEED.fast * scale,
  };
}
