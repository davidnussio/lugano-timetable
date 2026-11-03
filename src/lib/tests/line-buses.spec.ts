import { describe, expect, it } from "vitest";
import { type Departure, InTimeStatus, RoutingStatus } from "~/timetable/models";
import { lineBuses, stopOffsets } from "../line-buses";

const stop = (UID: string, Time: string, Status = RoutingStatus.FeatureStation) => ({
  UID,
  Time,
  Status,
});

// Cornaredo 08:00, then a stop every two minutes
const stops = [
  stop("1", "00:00", RoutingStatus.Origin),
  stop("2", "08:02"),
  stop("3", "08:04"),
  stop("4", "08:06"),
];

const now = Date.UTC(2026, 10, 4, 7, 0);

const departure = (
  target: string,
  uid: number,
  waitMin: number,
  extra: Partial<Departure> = {}
): Departure => ({
  Target: target,
  Route: "23",
  RouteCode: "6",
  Dir: "1",
  Routing: "5",
  Dest: "Brè",
  Img: "6.jpg",
  Time: "08:00",
  Pred: InTimeStatus.OnTime,
  Uid: uid,
  DepartureAt: now + waitMin * 60_000,
  ...extra,
});

describe("stopOffsets", () => {
  it("measures the minutes from the first stop", () => {
    expect(stopOffsets(stops)).toEqual([0, 1.5, 3.5, 5.5]);
  });

  it("fills the times missing and crosses midnight", () => {
    expect(
      stopOffsets([stop("1", "23:58"), stop("2", "--"), stop("3", "00:02")])
    ).toEqual([0, 2, 4]);
  });
});

describe("lineBuses", () => {
  it("places a bus between the stops from the time to the next", () => {
    const [bus] = lineBuses(stops, [departure("3", 7, 1), departure("4", 7, 3)], "23", "1", now);
    expect(bus.next).toBe(2);
    expect(bus.position).toBeCloseTo(1.5);
    expect(bus.departure.Target).toBe("3");
  });

  it("puts a bus about to arrive at the stop", () => {
    const [bus] = lineBuses(stops, [departure("2", 7, 0.2)], "23", "1", now);
    expect(bus.position).toBe(1);
  });

  it("keeps the buses waiting at the first stop only when about to leave", () => {
    const buses = lineBuses(
      stops,
      [departure("1", 7, 5), departure("1", 8, 40)],
      "23",
      "1",
      now
    );
    expect(buses.map((bus) => [bus.uid, bus.waiting, bus.position])).toEqual([[7, true, 0]]);
  });

  it("lists the furthest bus first, of the line and direction only", () => {
    const buses = lineBuses(
      stops,
      [
        departure("2", 7, 1),
        departure("4", 8, 1, { Pred: InTimeStatus.Delayed }),
        departure("4", 9, 1, { Dir: "2" }),
        departure("4", 10, 1, { Route: "24" }),
        departure("4", 11, 1, { Uid: undefined }),
      ],
      "23",
      "1",
      now
    );
    expect(buses.map((bus) => [bus.uid, bus.delayed])).toEqual([
      [8, true],
      [7, false],
    ]);
  });
});
