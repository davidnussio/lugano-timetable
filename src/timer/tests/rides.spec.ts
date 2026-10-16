import { describe, expect, it } from "vitest";
import { type Departure, InTimeStatus } from "~/timetable/models";
import {
  createRide,
  type FavoriteRide,
  hourScore,
  rankRides,
  recordStart,
  rideDepartures,
  sameRide,
  toggleRide,
} from "../rides";
import { isFavoriteRide, isStoredRides } from "../valid";

const MIN = 60_000;

const departure = (patch: Partial<Departure> = {}): Departure => ({
  Target: "12",
  Route: "19",
  RouteCode: "1",
  Dir: "1",
  Routing: "586",
  Dest: "Castagnola",
  Img: "19.jpg",
  Time: "08:10",
  Pred: InTimeStatus.OnTime,
  ...patch,
});

const centro = { name: "Centro", label: "Lugano, Centro", identifiers: ["12", "13"] };
const cornaredo = { name: "Cornaredo", label: "Lugano, Cornaredo", identifiers: ["40"] };

const withHours = (ride: FavoriteRide, starts: Record<number, number>): FavoriteRide => ({
  ...ride,
  hours: ride.hours.map((count, hour) => count + (starts[hour] ?? 0)),
});

const one = createRide(departure(), centro);
const two = createRide(departure({ Route: "20", RouteCode: "2", Img: "20.jpg" }), centro);
const three = createRide(departure({ Target: "40", Dir: "2" }), cornaredo);

describe("createRide", () => {
  it("takes the line and direction of the departure, with no timer yet", () => {
    expect(one).toMatchObject({ route: "19", line: "1", img: "19.jpg", dir: "1" });
    expect(one.destination).toBe("Castagnola");
    expect(one.hours).toHaveLength(24);
    expect(one.hours.every((count) => count === 0)).toBe(true);
  });

  it("is the same ride only on the same stop, line and direction", () => {
    expect(sameRide(one, { identifiers: ["12", "13"], route: "19", dir: "1" })).toBe(true);
    expect(sameRide(one, { identifiers: ["12", "13"], route: "19", dir: "2" })).toBe(false);
    expect(sameRide(one, { identifiers: ["12"], route: "19", dir: "1" })).toBe(false);
  });
});

describe("toggleRide", () => {
  it("adds the ride last, then removes it", () => {
    const added = toggleRide([one], two);
    expect(added).toEqual([one, two]);
    // Its timers do not make it another ride
    expect(toggleRide(added, withHours(two, { 8: 3 }))).toEqual([one]);
  });
});

describe("recordStart", () => {
  const key = { identifiers: centro.identifiers, route: "19", dir: "1" };

  it("counts the timer in its hour", () => {
    const rides = recordStart(recordStart([one, two], key, 7), key, 7);
    expect(rides[0].hours[7]).toBe(2);
    expect(rides[1]).toBe(two);
  });

  it("leaves the rides as they are when not a favorite", () => {
    const rides = [one, two];
    expect(recordStart(rides, { ...key, dir: "2" }, 7)).toBe(rides);
  });

  it("halves the histogram once an hour is full", () => {
    const full = withHours(one, { 7: 20, 18: 5, 9: 1 });
    const [ride] = recordStart([full], key, 7);
    expect(ride.hours[7]).toBe(10);
    expect(ride.hours[18]).toBe(2);
    expect(ride.hours[9]).toBe(0);
  });
});

describe("hourScore", () => {
  it("counts the hour double and the hours around it once, across midnight", () => {
    const hours = withHours(one, { 23: 1, 0: 2, 1: 4, 5: 9 }).hours;
    expect(hourScore(hours, 0)).toBe(1 + 2 * 2 + 4);
    expect(hourScore(hours, 23)).toBe(2 * 1 + 2);
    expect(hourScore(hours, 12)).toBe(0);
  });
});

describe("rankRides", () => {
  it("puts first the rides taken around this time", () => {
    const morning = withHours(two, { 7: 3 });
    const evening = withHours(three, { 18: 5 });
    expect(rankRides([one, morning, evening], 8)).toEqual([morning, one, evening]);
    expect(rankRides([one, morning, evening], 18)).toEqual([evening, one, morning]);
  });

  it("then the nearest, when the distance is known", () => {
    const distances = new Map([
      [one, 900],
      [two, undefined],
      [three, 150],
    ]);
    const distanceOf = (ride: FavoriteRide) => distances.get(ride);
    expect(rankRides([one, two, three], 8, distanceOf)).toEqual([three, one, two]);
    // Habits win over the distance
    const taken = withHours(two, { 8: 1 });
    distances.set(taken, undefined);
    expect(rankRides([one, taken, three], 8, distanceOf)).toEqual([taken, three, one]);
  });

  it("keeps the order they were added otherwise", () => {
    expect(rankRides([three, one, two], 12)).toEqual([three, one, two]);
  });
});

describe("rideDepartures", () => {
  it("keeps the line and direction of the ride, soonest first", () => {
    const later = departure({ Uid: 2, Time: "08:20", DepartureAt: 20 * MIN });
    const sooner = departure({ Uid: 1, Time: "08:10", DepartureAt: 10 * MIN });
    const otherLine = departure({ Route: "20", DepartureAt: 5 * MIN });
    const otherDir = departure({ Dir: "2", DepartureAt: 5 * MIN });
    expect(rideDepartures([later, otherLine, sooner, otherDir], one)).toEqual([sooner, later]);
  });

  it("orders the departures without a real-time wait by clock time", () => {
    const a = departure({ Time: "08:40" });
    const b = departure({ Time: "08:25" });
    expect(rideDepartures([a, b], one)).toEqual([b, a]);
  });
});

describe("isStoredRides", () => {
  it("accepts the rides the app creates, saved and read back", () => {
    const rides = [one, withHours(two, { 7: 2 })];
    expect(isStoredRides(JSON.parse(JSON.stringify(rides)))).toBe(true);
    expect(isStoredRides([])).toBe(true);
  });

  it("rejects values of another shape", () => {
    expect(isFavoriteRide({ ...one, hours: [1, 2] })).toBe(false);
    expect(isFavoriteRide({ ...one, stop: { name: "Centro" } })).toBe(false);
    expect(isFavoriteRide({ ...one, route: 19 })).toBe(false);
    expect(isStoredRides({ rides: [one] })).toBe(false);
    expect(isStoredRides(null)).toBe(false);
  });
});
