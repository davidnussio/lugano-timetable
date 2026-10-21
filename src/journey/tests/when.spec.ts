import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg } from "../models";
import { arrivalTime, arrivingBy, NOW, searchAt, zurichAt, zurichTime } from "../when";

// Tuesday 20 October 2026, 10:08 in Lugano (UTC+2)
const now = Date.UTC(2026, 9, 20, 8, 8);

describe("zurichAt", () => {
  it("reads a time in Lugano, on the day chosen", () => {
    expect(zurichAt(0, "08:00", now)).toBe(Date.UTC(2026, 9, 20, 6, 0));
    expect(zurichAt(2, "23:30", now)).toBe(Date.UTC(2026, 9, 22, 21, 30));
    expect(zurichAt(0, "8 h", now)).toBeUndefined();
  });

  it("follows the change of the clocks", () => {
    // Winter time from Sunday 25 October: UTC+1
    expect(zurichAt(6, "08:00", now)).toBe(Date.UTC(2026, 9, 26, 7, 0));
  });

  it("starts the day in Lugano, not in UTC", () => {
    // 00:30 in Lugano is still the day before in UTC
    const night = Date.UTC(2026, 9, 20, 22, 30);
    expect(zurichAt(0, "07:00", night)).toBe(Date.UTC(2026, 9, 21, 5, 0));
  });
});

describe("searchAt", () => {
  it("is now unless a time or another day is chosen", () => {
    expect(searchAt(NOW, now)).toBeUndefined();
    expect(searchAt({ day: 1, arrive: false }, now)).toBe(Date.UTC(2026, 9, 21, 8, 8));
    expect(searchAt({ day: 0, time: "18:15", arrive: true }, now)).toBe(
      Date.UTC(2026, 9, 20, 16, 15)
    );
  });
});

describe("arrivalTime", () => {
  it("rounds an hour from now up to the quarter", () => {
    expect(zurichTime(now)).toBe("10:08");
    expect(arrivalTime(now)).toBe("11:15");
  });
});

describe("arrivingBy", () => {
  // Arriving by 07:30 in Lugano
  const at = Date.UTC(2026, 9, 22, 5, 30);
  const minutes = (n: number) => n * 60_000;
  // Only the arrival of the last leg counts
  const arriving = (ms: number, walkAfterMs?: number, estimated?: number): Connection => ({
    legs: [{ arrival: { scheduled: ms, estimated } } as PlannedLeg],
    walkAfterMs,
  });

  it("drops the connections arriving more than an hour early", () => {
    const night = arriving(at - minutes(415));
    const early = arriving(at - minutes(61));
    const hour = arriving(at - minutes(60));
    const close = arriving(at - minutes(5));
    expect(arrivingBy([night, early, hour, close], at)).toEqual([hour, close]);
  });

  it("keeps the one arriving last when none is within the hour", () => {
    const night = arriving(at - minutes(415));
    const later = arriving(at - minutes(90));
    expect(arrivingBy([later, night], at)).toEqual([later]);
  });

  it("counts the walk at the end and the delays", () => {
    const walking = arriving(at - minutes(65), minutes(6));
    const late = arriving(at - minutes(70), undefined, at - minutes(50));
    expect(arrivingBy([walking, late], at)).toEqual([walking, late]);
  });

  it("finds nothing in nothing", () => {
    expect(arrivingBy([], at)).toEqual([]);
  });
});
