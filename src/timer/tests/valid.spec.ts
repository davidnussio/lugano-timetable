import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import { InTimeStatus } from "~/timetable/models";
import { createJourneyTimer, createTimer } from "../store";
import { isActiveTimer, isStoredTimer } from "../valid";

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
    for (const timer of [single, journey]) {
      expect(isActiveTimer(JSON.parse(JSON.stringify(timer)))).toBe(true);
    }
  });

  it("rejects values of another shape", () => {
    expect(isActiveTimer({ ...single, departureAt: "08:10" })).toBe(false);
    expect(isActiveTimer({ ...single, stop: { name: "Centro" } })).toBe(false);
    expect(isActiveTimer({ ...journey, journey: { ...journey.journey, legs: [] } })).toBe(false);
    expect(isActiveTimer([])).toBe(false);
    expect(isActiveTimer("timer")).toBe(false);
  });

  it("accepts no timer as stored value", () => {
    expect(isStoredTimer(null)).toBe(true);
    expect(isStoredTimer(undefined)).toBe(false);
  });
});
