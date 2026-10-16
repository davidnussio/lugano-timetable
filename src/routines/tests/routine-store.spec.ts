import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg } from "~/journey/models";
import {
  decodeKey,
  defaultArriveBy,
  defaultWalkMinutes,
  durationMinutes,
  isRoutineList,
  newRoutineId,
} from "../routine-store";
import { zurichTime } from "../schedule";
import { Routine } from "../schema";

const MIN = 60_000;
const at = (time: string) => zurichTime("2026-10-16", time);

const leg = (departure: string, arrival: string, walkBeforeMs?: number): PlannedLeg => ({
  trip: "000606",
  category: "B",
  line: "6",
  destination: "Lugano, Centro",
  from: { id: "8591577", name: "Albonago" },
  to: { id: "8591603", name: "Lugano, Centro" },
  departure: { scheduled: at(departure) },
  arrival: { scheduled: at(arrival), estimated: at(arrival) + 2 * MIN },
  ...(walkBeforeMs === undefined ? {} : { walkBeforeMs }),
});

const connection: Connection = { legs: [leg("07:37", "07:52", 6.4 * MIN)], walkAfterMs: 3 * MIN };

describe("form defaults", () => {
  it("rounds the arrival up to 5 minutes", () => {
    // 7:52 late by 2 minutes
    expect(defaultArriveBy(connection)).toBe("07:55");
    expect(defaultArriveBy({ legs: [leg("07:30", "07:43")] })).toBe("07:45");
    expect(defaultArriveBy(undefined)).toBe("08:00");
  });

  it("takes the walk planned before the first bus, 5 minutes otherwise", () => {
    expect(defaultWalkMinutes(connection)).toBe(6);
    expect(defaultWalkMinutes({ legs: [leg("07:37", "07:52")] })).toBe(5);
    expect(defaultWalkMinutes(undefined)).toBe(5);
  });

  it("measures the journey from the first bus", () => {
    expect(durationMinutes(connection)).toBe(20);
    expect(durationMinutes(undefined)).toBe(30);
  });
});

describe("decodeKey", () => {
  it("reads the base64url keys of web-push", () => {
    expect([...decodeKey("AQIDBP_-")]).toEqual([1, 2, 3, 4, 255, 254]);
    // A VAPID public key is an uncompressed P-256 point: 65 bytes
    const key = decodeKey(
      "BCcN333csii7DiDOvhQvlkAIVISFhwabvVEQncVueFFJTyvcA69-Z21oRaVfRQBwSU3X2IU0aX6aOunWMT1T4S4"
    );
    expect(key.length).toBe(65);
    expect(key[0]).toBe(4);
  });
});

describe("routines", () => {
  const routine = {
    id: newRoutineId(),
    from: { id: "8591577", name: "Albonago" },
    to: { id: "8591603", name: "Lugano, Centro" },
    days: [1, 2, 3, 4, 5],
    arriveBy: "07:55",
    walkMinutes: 6,
    durationMinutes: 20,
    paused: false,
  };

  it("makes ids the server accepts", () => {
    expect(() => Schema.decodeUnknownSync(Routine)(routine)).not.toThrow();
    expect(routine.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("drops a stored list of another shape", () => {
    expect(isRoutineList([routine])).toBe(true);
    expect(isRoutineList([{ ...routine, days: undefined }])).toBe(false);
    expect(isRoutineList({ routines: [] })).toBe(false);
  });

  it("refuses wrong times and days", () => {
    const decode = Schema.decodeUnknownSync(Routine);
    expect(() => decode({ ...routine, arriveBy: "7:55" })).toThrow();
    expect(() => decode({ ...routine, arriveBy: "24:00" })).toThrow();
    expect(() => decode({ ...routine, days: [] })).toThrow();
    expect(() => decode({ ...routine, days: [0] })).toThrow();
    expect(() => decode({ ...routine, id: "a/b" })).toThrow();
  });
});
