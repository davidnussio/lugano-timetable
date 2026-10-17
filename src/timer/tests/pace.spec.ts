import { describe, expect, it } from "vitest";
import {
  followWalk,
  type LearnedPace,
  learnedSpeed,
  learnPace,
  modelSpeed,
  NO_PACE,
  paceSpeeds,
  type WalkReading,
  type WalkTrack,
  walkSpeed,
} from "../pace";
import { type Approach, approach, detourFactor, PACE_SPEED, walkingSeconds } from "../plan";

const SECOND = 1000;
const MIN = 60 * SECOND;

const reading = (meters: number, at: number, extra: Partial<WalkReading> = {}): WalkReading => ({
  meters,
  accuracy: 10,
  at,
  climb: 0,
  pace: "normal",
  ...extra,
});

const started: WalkTrack = { at: 0, meters: 600, climb: 0, pace: "normal", lastAt: 0 };

// On the way since the GPS saw the user 40 m farther from the stop
const away: Approach = { stage: "away", farthest: { meters: 640, accuracy: 10 } };
const walking: Approach = { ...away, stage: "walking" };
const arrived: Approach = { stage: "arrived" };
const step = (walk: WalkTrack | undefined, fix: WalkReading) =>
  followWalk(walk, walking, walking, fix);

describe("modelSpeed", () => {
  it("is the speed at which the model predicts the time walked", () => {
    for (const [meters, climb] of [
      [500, 0],
      [500, 40],
      [1200, -30],
    ]) {
      const seconds = walkingSeconds(meters, 1.45, climb);
      expect(modelSpeed(meters, climb, seconds)).toBeCloseTo(1.45);
    }
  });
});

describe("followWalk", () => {
  it("starts when the user is on the way", () => {
    expect(followWalk(undefined, away, walking, reading(600, 0)).walk).toEqual(started);
    expect(followWalk(undefined, away, away, reading(600, 0)).walk).toBeUndefined();
  });

  it("returns the same walk when the fix is read again", () => {
    const next = step(started, reading(500, MIN)).walk;
    expect(step(next, reading(500, MIN)).walk).toBe(next);
    const restarted = step(started, reading(620, MIN)).walk;
    expect(step(restarted, reading(620, MIN)).walk).toBe(restarted);
  });

  it("starts again while the user is not closer than the farthest fix", () => {
    expect(step(started, reading(620, 5 * MIN)).walk).toMatchObject({
      at: 5 * MIN,
      meters: 620,
      lastAt: 5 * MIN,
    });
    expect(step(started, reading(610, 5 * MIN)).walk).toMatchObject({ at: 0, meters: 600 });
  });

  it("ignores the imprecise fixes", () => {
    expect(step(started, reading(400, MIN, { accuracy: 80 })).walk).toBe(started);
  });

  it("is spoiled by a fix too far to walk, or lost for too long", () => {
    expect(step(started, reading(3000, MIN)).walk?.spoiled).toBe(true);
    expect(step(started, reading(500, 3 * MIN)).walk?.spoiled).toBe(true);
    expect(step(started, reading(500, MIN)).walk?.spoiled).toBeUndefined();
  });

  it("takes the climb of the start from a fix close to it", () => {
    const unknown = { ...started, climb: undefined };
    const near = step(unknown, reading(570, 20 * SECOND, { climb: 30 }));
    expect(near.walk?.climb).toBe(30);
    expect(step(unknown, reading(400, MIN, { climb: 30 })).walk?.climb).toBeUndefined();
    expect(step(near.walk, reading(400, MIN, { climb: 10 })).walk?.climb).toBe(30);
  });

  it("ends at the stop with the speed of the walk", () => {
    const last = { ...started, lastAt: 9 * MIN };
    const { walk, speed } = followWalk(last, walking, arrived, reading(20, 10 * MIN));
    expect(walk).toBeUndefined();
    expect(speed).toBeCloseTo(modelSpeed(580, 0, 600));
    // Once there, no other walk
    expect(followWalk(undefined, arrived, arrived, reading(10, 11 * MIN))).toEqual({
      walk: undefined,
    });
    // Arrived without being seen on the way
    expect(followWalk(undefined, away, arrived, reading(20, MIN)).speed).toBeUndefined();
  });

  // The GPS of a walk on the flat at `speed` (model speed) from 800 m,
  // after `home` milliseconds at home: a fix every second, with a few
  // meters of noise, and maybe a `glitch`. The speed learned at the stop.
  function simulate(
    speed: number,
    home: number,
    glitch?: { readonly at: number; readonly meters: number }
  ): number | undefined {
    const crow = speed / detourFactor(800, 0);
    let state: Approach | undefined;
    let walk: WalkTrack | undefined;
    let learned: number | undefined;
    for (let at = 0; at < home + 30 * MIN; at += SECOND) {
      const noise = 6 * Math.sin(at / 7000);
      const meters =
        glitch?.at === at
          ? glitch.meters
          : Math.max(0, 800 - Math.max(0, at - home) / 1000 * crow) + noise;
      const before = state;
      state = approach(state, meters, 10);
      const next = followWalk(walk, before, state, reading(meters, at));
      walk = next.walk;
      learned ??= next.speed;
    }
    return learned;
  }

  it("measures a whole walk", () => {
    expect(simulate(1.4, 5 * MIN)).toBeCloseTo(1.4, 1);
  });

  it("does not count the time at home after a jump of the GPS", () => {
    // A fix 80 m closer makes the user look on the way while still at home
    expect(simulate(1.4, 10 * MIN, { at: MIN, meters: 720 })).toBeCloseTo(1.4, 1);
  });
});

describe("walkSpeed", () => {
  const walk: WalkTrack = { ...started, lastAt: 9.5 * MIN };
  const arrival = { meters: 20, at: 10 * MIN, pace: "normal" } as const;

  it("is the model speed of the walk", () => {
    // 580 m on level ground: 667 m of streets in 10 minutes
    expect(walkSpeed(walk, arrival)).toBeCloseTo((580 * 1.15) / 600);
  });

  it("counts the climb", () => {
    const uphill = walkSpeed({ ...walk, climb: 40 }, arrival);
    expect(uphill).toBeCloseTo(modelSpeed(580, 40, 600));
    expect(uphill).toBeGreaterThan(walkSpeed(walk, arrival) ?? Infinity);
  });

  it("tells the normal pace from a walk at another one", () => {
    const fast = walkSpeed({ ...walk, pace: "fast" }, { ...arrival, pace: "fast" });
    expect(fast).toBeCloseTo(((580 * 1.15) / 600) * (PACE_SPEED.normal / PACE_SPEED.fast));
  });

  it("rejects the walks it cannot learn from", () => {
    // Too short, or too quick
    expect(walkSpeed({ ...walk, meters: 160 }, arrival)).toBeUndefined();
    expect(walkSpeed({ ...walk, meters: 300, at: 9 * MIN }, arrival)).toBeUndefined();
    // Too slow (a stop on the way) or too fast (a bike)
    expect(walkSpeed({ ...walk, at: -20 * MIN }, arrival)).toBeUndefined();
    expect(walkSpeed({ ...walk, meters: 2400, at: 5 * MIN }, arrival)).toBeUndefined();
    // Not a walk, the climb unknown, a change of pace, lost before the stop
    expect(walkSpeed({ ...walk, spoiled: true }, arrival)).toBeUndefined();
    expect(walkSpeed({ ...walk, climb: undefined }, arrival)).toBeUndefined();
    expect(walkSpeed(walk, { ...arrival, pace: "fast" })).toBeUndefined();
    expect(walkSpeed({ ...walk, lastAt: 7 * MIN }, arrival)).toBeUndefined();
  });
});

describe("learnPace", () => {
  it("keeps the latest walks and counts them all", () => {
    let learned: LearnedPace = NO_PACE;
    for (let index = 0; index < 12; index++) learned = learnPace(learned, 1 + index / 10);
    expect(learned.count).toBe(12);
    expect(learned.speeds).toHaveLength(10);
    expect(learned.speeds[0]).toBeCloseTo(1.2);
  });
});

describe("learnedSpeed", () => {
  it("waits for enough walks", () => {
    expect(learnedSpeed(NO_PACE)).toBeUndefined();
    expect(learnedSpeed({ speeds: [1.4, 1.5], count: 2 })).toBeUndefined();
  });

  it("is the median, whatever an odd walk did", () => {
    expect(learnedSpeed({ speeds: [1.4, 0.7, 1.5], count: 3 })).toBe(1.4);
    expect(learnedSpeed({ speeds: [1.4, 0.7, 1.5, 1.6], count: 8 })).toBeCloseTo(1.45);
  });
});

describe("paceSpeeds", () => {
  it("is the default speeds until the pace is learned", () => {
    expect(paceSpeeds(NO_PACE)).toEqual(PACE_SPEED);
  });

  it("scales the other paces from the learned one", () => {
    const speeds = paceSpeeds({ speeds: [1.56, 1.56, 1.56], count: 3 });
    expect(speeds.normal).toBe(1.56);
    expect(speeds.slow / speeds.normal).toBeCloseTo(PACE_SPEED.slow / PACE_SPEED.normal);
    expect(speeds.fast / speeds.normal).toBeCloseTo(PACE_SPEED.fast / PACE_SPEED.normal);
  });
});
