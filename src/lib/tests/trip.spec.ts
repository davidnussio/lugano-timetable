import { describe, expect, it } from "vitest";
import { busIndex, busPosition, stopState, tripDeparture } from "../trip";
import { InTimeStatus, RoutingStatus } from "../../timetable/models";

const stops = (...statuses: RoutingStatus[]) =>
  statuses.map((Status) => ({ Status }));
const { FeatureStation: F, CurrentStation: C, PassedStation: P, Origin: O } =
  RoutingStatus;

describe("busPosition", () => {
  it("finds the bus at a stop", () => {
    const position = busPosition(stops(O, P, C, F, F));
    expect(position).toEqual({ kind: "at", index: 2 });
    expect([0, 1, 2, 3].map((i) => stopState(position, i))).toEqual([
      "passed",
      "passed",
      "current",
      "upcoming",
    ]);
  });

  it("finds the bus between two stops", () => {
    const position = busPosition(stops(O, P, P, F, F));
    expect(position).toEqual({ kind: "between", from: 2 });
    expect(stopState(position, 2)).toBe("passed");
    expect(stopState(position, 3)).toBe("upcoming");
    expect(busIndex(position, 5)).toBe(3);
  });

  it("treats the origin as passed once left", () => {
    expect(busPosition(stops(O, F, F))).toEqual({ kind: "between", from: 0 });
  });

  it("knows when the bus has not left or has arrived", () => {
    expect(busPosition(stops(F, F, F))).toEqual({ kind: "origin" });
    expect(busPosition(stops(O, P, P))).toEqual({ kind: "arrived" });
  });
});

describe("tripDeparture", () => {
  const trip = { target: "101", route: "4", dir: "1", routing: "7" };
  const departure = (Time: string, DepartureAt: number, extra = {}) => ({
    Target: "101",
    Route: "4",
    RouteCode: "4",
    Dir: "1",
    Routing: "7",
    Dest: "Canobbio",
    Img: "4",
    Time,
    Pred: InTimeStatus.OnTime,
    DepartureAt,
    ...extra,
  });

  it("finds the run passing at the time of the stop", () => {
    const runs = [departure("18:19", 1), departure("18:34", 2)];
    expect(tripDeparture(runs, trip, "18:34")).toBe(runs[1]);
  });

  it("falls back on the soonest run of the line", () => {
    const runs = [departure("18:34", 2), departure("18:19", 1)];
    expect(tripDeparture(runs, trip, "18:20")).toBe(runs[1]);
  });

  it("ignores the other lines and platforms", () => {
    const runs = [
      departure("18:19", 1, { Routing: "8" }),
      departure("18:19", 1, { Target: "102" }),
      departure("18:19", 1, { Dir: "2" }),
    ];
    expect(tripDeparture(runs, trip, "18:19")).toBeUndefined();
  });
});
