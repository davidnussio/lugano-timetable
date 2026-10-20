import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import { InTimeStatus } from "~/timetable/models";
import { createJourneyTimer, createTimer } from "../store";
import { learnPace, NO_PACE } from "../pace";
import { isActiveTimer, isLearnedPace, isStoredTimer } from "../valid";

const MIN = 60_000;

const station = (id: string, name: string): Station => ({
  id,
  name,
  position: { lat: 46, lon: 8.95 },
});
const centro = station("8591603", "Lugano, Centro");
const lugano = station("8505300", "Lugano");

const leg: PlannedLeg = {
  trip: "003000",
  category: "B",
  line: "3",
  operator: "TPL",
  destination: "Lugano",
  from: centro,
  to: lugano,
  departure: { scheduled: 10 * MIN },
  arrival: { scheduled: 20 * MIN, estimated: 21 * MIN },
};
const connection: Connection = { legs: [leg], walkAfterMs: 2 * MIN };

const single = createTimer(
  {
    Target: "12",
    Route: "3",
    RouteCode: "3",
    Dir: "1",
    Routing: "586",
    Dest: "Lugano",
    Img: "3.jpg",
    Time: "08:10",
    Pred: InTimeStatus.OnTime,
    Uid: 7,
    DepartureAt: 10 * MIN,
  },
  { name: "Centro", label: "Lugano, Centro", identifiers: ["12"] },
  { Id: "12", Lat: 46, Lon: 8.95 },
  0
);
const journey = createJourneyTimer(connection, centro, lugano, undefined, 0);

describe("isActiveTimer", () => {
  it("accepts the timers the app creates, saved and read back", () => {
    const walking = {
      ...single,
      walk: { at: 0, meters: 600, climb: 12, pace: "normal", lastAt: 0 },
    } as const;
    const atStop = { ...single, atStop: { at: 5 * MIN, leftAt: 0, meters: 420 } };
    for (const timer of [single, journey, walking, atStop]) {
      expect(isActiveTimer(JSON.parse(JSON.stringify(timer)))).toBe(true);
    }
  });

  it("rejects values of another shape", () => {
    expect(isActiveTimer({ ...single, departureAt: "08:10" })).toBe(false);
    expect(isActiveTimer({ ...single, stop: { name: "Centro" } })).toBe(false);
    expect(isActiveTimer({ ...journey, journey: { ...journey.journey, legs: [] } })).toBe(false);
    expect(isActiveTimer({ ...single, walk: { at: 0, meters: 600 } })).toBe(false);
    expect(isActiveTimer({ ...single, atStop: { leftAt: 0 } })).toBe(false);
    expect(isActiveTimer([])).toBe(false);
    expect(isActiveTimer("timer")).toBe(false);
  });

  it("accepts a stop to get off, also on timers saved before it", () => {
    const getOff = {
      target: "15",
      name: "Cornaredo",
      position: { lat: 46.02, lon: 8.96 },
      arrivalAt: 25 * MIN,
      left: true,
      alerted: ["next"],
    };
    expect(isActiveTimer(JSON.parse(JSON.stringify({ ...single, getOff })))).toBe(true);
    expect(
      isActiveTimer({ ...single, getOff: { target: "15", name: "Cornaredo", alerted: [] } })
    ).toBe(true);
    expect(isActiveTimer({ ...single, getOff: { ...getOff, alerted: ["later"] } })).toBe(false);
    expect(isActiveTimer({ ...single, getOff: { ...getOff, left: "yes" } })).toBe(false);
    expect(isActiveTimer({ ...single, getOff: { name: "Cornaredo", alerted: [] } })).toBe(false);
  });

  it("accepts no timer as stored value", () => {
    expect(isStoredTimer(null)).toBe(true);
    expect(isStoredTimer(undefined)).toBe(false);
  });
});

describe("isLearnedPace", () => {
  it("accepts the paces the app learns, saved and read back", () => {
    for (const learned of [NO_PACE, learnPace(NO_PACE, 1.4)]) {
      expect(isLearnedPace(JSON.parse(JSON.stringify(learned)))).toBe(true);
    }
  });

  it("rejects values of another shape", () => {
    expect(isLearnedPace({ speeds: ["1.4"], count: 1 })).toBe(false);
    expect(isLearnedPace({ speeds: [1.4] })).toBe(false);
    expect(isLearnedPace(null)).toBe(false);
  });
});
