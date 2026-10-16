import { describe, expect, it } from "vitest";
import {
  alertMessage,
  alertThresholds,
  approach,
  countdown,
  distanceMeters,
  dueAlert,
  isFar,
  minutesLeft,
  PACE_SPEED,
  peakHold,
  reliableFix,
  walkingRelease,
  walkingSeconds,
  weatherDelay,
  weatherWalk,
} from "../plan";

describe("alertThresholds", () => {
  it("spaces alerts as a fraction of the remaining time", () => {
    expect(alertThresholds(20)).toEqual([12, 7, 4, 3, 2, 1, 0]);
    expect(alertThresholds(10)).toEqual([6, 4, 2, 1, 0]);
    expect(alertThresholds(60)).toEqual([36, 22, 13, 8, 5, 3, 2, 1, 0]);
  });

  it("only alerts to leave when there is less than a minute", () => {
    expect(alertThresholds(1)).toEqual([0]);
    expect(alertThresholds(0)).toEqual([0]);
    expect(alertThresholds(-3)).toEqual([0]);
  });

  it("never alerts right at the start", () => {
    expect(alertThresholds(2)).toEqual([1, 0]);
    expect(alertThresholds(3)).toEqual([2, 1, 0]);
  });
});

describe("dueAlert", () => {
  const thresholds = [12, 7, 4, 3, 2, 1, 0];

  it("fires each threshold once", () => {
    expect(dueAlert(thresholds, [], 15)).toBeUndefined();
    expect(dueAlert(thresholds, [], 11.9)).toBe(12);
    expect(dueAlert(thresholds, [12], 11)).toBeUndefined();
    expect(dueAlert(thresholds, [12], 7)).toBe(7);
  });

  it("only fires the latest threshold after a gap", () => {
    expect(dueAlert(thresholds, [12], 2.5)).toBe(3);
  });

  it("does not repeat alerts when the bus is delayed", () => {
    expect(dueAlert(thresholds, [12, 7, 4], 6)).toBeUndefined();
    expect(dueAlert(thresholds, [12, 7, 4], 4)).toBeUndefined();
    expect(dueAlert(thresholds, [12, 7, 4], 3)).toBe(3);
  });

  it("fires the leave alert when late", () => {
    expect(dueAlert(thresholds, [12, 7], -2)).toBe(0);
    expect(dueAlert(thresholds, [0], -3)).toBeUndefined();
  });
});

describe("walking", () => {
  it("computes distances between positions", () => {
    // Lugano, Bellavista → Lugano, Centro
    const meters = distanceMeters(
      { lat: 46.00374, lon: 8.94763 },
      { lat: 46.00495, lon: 8.95153 }
    );
    expect(meters).toBeGreaterThan(320);
    expect(meters).toBeLessThan(340);
  });

  it("walks slower than the crow flies", () => {
    expect(walkingSeconds(1300)).toBeCloseTo(1350);
    expect(walkingSeconds(1000, PACE_SPEED.slow)).toBeCloseTo(1350);
  });

  it("walks slower uphill, as on the flat downhill", () => {
    // 500 m to the stop, 1350 × 500 / 1300 seconds on the flat
    const flat = walkingSeconds(500);
    // 35 m up over 675 m of streets: about a fifth more
    expect(walkingSeconds(500, PACE_SPEED.normal, 35) / flat).toBeCloseTo(Math.exp((3.5 * 35) / 675));
    expect(walkingSeconds(500, PACE_SPEED.normal, 35) - flat).toBeGreaterThan(90);
    expect(walkingSeconds(500, PACE_SPEED.normal, -35)).toBeCloseTo(flat);
  });

  it("caps the slope of a short walk", () => {
    expect(walkingSeconds(20, PACE_SPEED.normal, 30)).toBeCloseTo(walkingSeconds(20) * Math.exp(3.5 * 0.25));
    expect(walkingSeconds(0, PACE_SPEED.normal, 10)).toBe(0);
  });
});

describe("weatherWalk", () => {
  const dry = { precipitation: 0, snowfall: 0, code: 3 };

  it("walks as usual when dry or unknown", () => {
    expect(weatherWalk(dry)).toEqual({ factor: 1 });
    expect(weatherWalk(undefined)).toEqual({ factor: 1 });
    // A drizzle does not count
    expect(weatherWalk({ ...dry, precipitation: 0.2, code: 51 })).toEqual({ factor: 1 });
  });

  it("walks slower in the rain, more under a downpour", () => {
    expect(weatherWalk({ ...dry, precipitation: 0.3, code: 53 })).toEqual({
      factor: 1.1,
      label: "Pioggia",
    });
    // The code of the model tells the rain also with little water
    expect(weatherWalk({ ...dry, precipitation: 0.1, code: 80 }).label).toBe("Pioggia");
    expect(weatherWalk({ ...dry, precipitation: 4, code: 63 })).toEqual({
      factor: 1.15,
      label: "Pioggia forte",
    });
    expect(weatherWalk({ ...dry, precipitation: 2, code: 82 }).factor).toBe(1.15);
  });

  it("walks much slower on snow and ice", () => {
    expect(weatherWalk({ ...dry, precipitation: 0.1, snowfall: 0.1 })).toEqual({
      factor: 1.3,
      label: "Neve",
    });
    // Snow wins over the rain of the same hour
    expect(weatherWalk({ precipitation: 5, snowfall: 0, code: 85 }).label).toBe("Neve");
    expect(weatherWalk({ ...dry, precipitation: 1, code: 66 })).toEqual({
      factor: 1.3,
      label: "Ghiaccio",
    });
    expect(weatherWalk({ ...dry, code: 56 }).factor).toBe(1.3);
  });
});

describe("weatherDelay", () => {
  it("tells the minutes added by the weather, from one up", () => {
    // 10 minutes dry, 11 in the rain
    expect(weatherDelay(660, { factor: 1.1, label: "Pioggia" })).toEqual({
      label: "Pioggia",
      minutes: 1,
    });
    expect(weatherDelay(1300, { factor: 1.3, label: "Neve" })).toEqual({
      label: "Neve",
      minutes: 5,
    });
    // 4 minutes dry: 24 seconds more
    expect(weatherDelay(264, { factor: 1.1, label: "Pioggia" })).toBeUndefined();
    expect(weatherDelay(600, { factor: 1 })).toBeUndefined();
  });
});

describe("countdown", () => {
  it("subtracts the walking time", () => {
    expect(countdown(600_000, 0, 120)).toEqual({
      departureMs: 600_000,
      leaveMs: 480_000,
      walkingMs: 120_000,
    });
    expect(countdown(600_000, 0, undefined).leaveMs).toBe(600_000);
  });

  it("rounds minutes up", () => {
    expect(minutesLeft(30_000)).toBe(1);
    expect(minutesLeft(180_000)).toBe(3);
    expect(minutesLeft(-30_000)).toBe(0);
    expect(minutesLeft(-61_000)).toBe(-1);
  });
});

describe("alertMessage", () => {
  it("tells when to leave", () => {
    expect(alertMessage("2", "Castagnola", countdown(600_000, 0, 300))).toEqual({
      title: "Esci tra 5 min",
      body: "Linea 2 per Castagnola · il bus parte tra 10 min, 5 min a piedi",
    });
    expect(alertMessage("2", "Castagnola", countdown(300_000, 0, 300)).title).toBe(
      "Esci ora"
    );
    expect(alertMessage("2", "Castagnola", countdown(120_000, 0, 300)).title).toBe(
      "In ritardo di 3 min: affrettati!"
    );
  });

  it("tells what slows down the walk", () => {
    expect(alertMessage("2", "Castagnola", countdown(600_000, 0, 300), "Pioggia forte").body).toBe(
      "Linea 2 per Castagnola · il bus parte tra 10 min, 5 min a piedi (pioggia forte)"
    );
  });

  it("counts down to the departure without a position", () => {
    expect(alertMessage("2", "Castagnola", countdown(240_000, 0, undefined))).toEqual({
      title: "Il bus parte tra 4 min",
      body: "Linea 2 per Castagnola",
    });
  });
});

describe("peakHold", () => {
  it("starts from the first value", () => {
    expect(peakHold(undefined, 300, 0)).toEqual({ value: 300, at: 0 });
  });

  it("rises gradually with the attack time constant", () => {
    const rising = (ms: number) =>
      peakHold({ value: 300, at: 0 }, 310, ms, 1, 3).value;
    expect(rising(0)).toBe(300);
    expect(rising(3000)).toBeCloseTo(300 + 10 * (1 - Math.exp(-1)));
    expect(rising(1000)).toBeLessThan(rising(2000));
    expect(rising(60_000)).toBeCloseTo(310);
  });

  it("rises at once without an attack time", () => {
    expect(peakHold({ value: 300, at: 0 }, 310, 1000, 1, 0).value).toBe(310);
  });

  it("follows the same curve whatever the readings in between", () => {
    const once = peakHold({ value: 300, at: 0 }, 310, 4000);
    const twice = peakHold(peakHold({ value: 300, at: 0 }, 310, 1500), 310, 4000);
    expect(twice.value).toBeCloseTo(once.value);
  });

  it("falls by at most one second per second", () => {
    expect(peakHold({ value: 300, at: 0 }, 290, 2000).value).toBe(298);
    expect(peakHold({ value: 300, at: 0 }, 290, 20_000).value).toBe(290);
  });

  it("keeps the time to leave from going back up with a noisy GPS", () => {
    const readings = [300, 304, 296, 299, 307, 291, 288, 295];
    const release = walkingRelease();
    let envelope = peakHold(undefined, readings[0], 0, release);
    let previousLeave = Infinity;
    readings.forEach((meters, second) => {
      envelope = peakHold(envelope, meters, second * 1000, release);
      const leave = 600 - second - walkingSeconds(envelope.value);
      expect(leave).toBeLessThanOrEqual(previousLeave + 1e-9);
      previousLeave = leave;
    });
  });
});

describe("reliableFix", () => {
  const startedAt = 10 * 60_000;

  it("needs a precise fix", () => {
    expect(reliableFix({ accuracy: 15, at: startedAt }, startedAt)).toBe(true);
    expect(reliableFix({ accuracy: 100, at: startedAt }, startedAt)).toBe(true);
    expect(reliableFix({ accuracy: 800, at: startedAt }, startedAt)).toBe(false);
  });

  it("ignores fixes from before the timer", () => {
    expect(reliableFix({ accuracy: 15, at: startedAt - 30_000 }, startedAt)).toBe(true);
    expect(reliableFix({ accuracy: 15, at: startedAt - 5 * 60_000 }, startedAt)).toBe(false);
  });
});

describe("isFar", () => {
  it("is beyond walking distance", () => {
    expect(isFar(800)).toBe(false);
    expect(isFar(2_500)).toBe(false);
    expect(isFar(19_000)).toBe(true);
  });
});

describe("approach", () => {
  it("starts away from the stop", () => {
    expect(approach(undefined, 300, 10)).toEqual({
      stage: "away",
      farthest: { meters: 300, accuracy: 10 },
    });
  });

  it("stays away while the GPS jitters", () => {
    let state = approach(undefined, 300, 10);
    for (const meters of [290, 305, 285, 310, 292]) {
      state = approach(state, meters, 10);
    }
    expect(state.stage).toBe("away");
  });

  it("keeps the same state when nothing changes", () => {
    const state = approach(undefined, 300, 10);
    expect(approach(state, 290, 10)).toBe(state);
  });

  it("is on the way once closer than the error of both fixes", () => {
    const state = approach(undefined, 300, 10);
    expect(approach(state, 280, 10).stage).toBe("away");
    expect(approach(state, 270, 10).stage).toBe("walking");
    expect(approach(state, 260, 30).stage).toBe("away");
    expect(approach(state, 230, 30).stage).toBe("walking");
  });

  it("measures the progress from the farthest fix", () => {
    const farther = approach(approach(undefined, 300, 10), 320, 10);
    expect(approach(farther, 290, 10).stage).toBe("walking");
  });

  it("does not count riding towards the stop as walking", () => {
    // On a train from Bellinzona
    let state = approach(undefined, 19_000, 10);
    for (const meters of [15_000, 9_000, 4_000]) {
      state = approach(state, meters, 10);
    }
    expect(state).toEqual({ stage: "away" });
    expect(approach(state, 2_000, 10)).toEqual({
      stage: "away",
      farthest: { meters: 2_000, accuracy: 10 },
    });
  });

  it("ignores imprecise fixes", () => {
    const state = approach(undefined, 300, 10);
    expect(approach(state, 100, 80)).toBe(state);
    expect(approach(undefined, 20, 80)).toEqual({ stage: "away" });
  });

  it("arrives near the stop and stays there", () => {
    const arrived = approach(approach(undefined, 90, 5), 20, 5);
    expect(arrived).toEqual({ stage: "arrived" });
    expect(approach(arrived, 60, 5)).toBe(arrived);
  });

  it("never goes back home once on the way", () => {
    const walking = approach(approach(undefined, 300, 10), 250, 10);
    expect(approach(walking, 320, 10).stage).toBe("walking");
  });
});
