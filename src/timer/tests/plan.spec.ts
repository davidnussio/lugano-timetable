import { describe, expect, it } from "vitest";
import {
  alertMessage,
  alertThresholds,
  countdown,
  distanceMeters,
  dueAlert,
  minutesLeft,
  walkingSeconds,
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
    expect(walkingSeconds(1000, "slow")).toBeCloseTo(1350);
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

  it("counts down to the departure without a position", () => {
    expect(alertMessage("2", "Castagnola", countdown(240_000, 0, undefined))).toEqual({
      title: "Il bus parte tra 4 min",
      body: "Linea 2 per Castagnola",
    });
  });
});
