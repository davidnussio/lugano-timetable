import { describe, expect, it } from "vitest";
import { busIndex, busPosition, stopState } from "../trip";
import { RoutingStatus } from "../../timetable/models";

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
