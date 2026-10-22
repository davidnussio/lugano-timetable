import { describe, expect, it } from "vitest";
import { RoutingStatus } from "~/timetable/models";
import { approach } from "../approach";

const MIN = 60_000;
const { FeatureStation: F, CurrentStation: C, PassedStation: P, Origin: O } =
  RoutingStatus;

// Stops "0" to "5" at 08:10 to 08:15: the user waits at "4"
const route = (...statuses: RoutingStatus[]) =>
  statuses.map((Status, index) => ({
    UID: String(index),
    Name: `Stop ${index}`,
    Time: `08:1${index}`,
    Status,
  }));

// 08:00 in Lugano (summer time)
const eight = Date.UTC(2026, 9, 16, 6, 0, 0);
const departureAt = eight + 14 * MIN;

const uids = (stops: ReadonlyArray<{ readonly UID: string }>) => stops.map(({ UID }) => UID);

describe("approach", () => {
  it("shows the two stops before the one of the user", () => {
    const result = approach(route(O, P, C, F, F, F), "4", departureAt, eight);
    expect(uids(result?.stops ?? [])).toEqual(["2", "3", "4"]);
    expect(result?.away).toBe(2);
  });

  it("puts the bus between two stops", () => {
    expect(approach(route(O, P, P, F, F, F), "4", departureAt, eight)?.away).toBe(1.5);
  });

  it("tells how far the bus is beyond the stops shown", () => {
    expect(approach(route(O, F, F, F, F, F), "4", departureAt, eight)?.away).toBe(3.5);
    expect(approach(route(F, F, F, F, F, F), "4", departureAt, eight)?.away).toBe(4);
  });

  it("has the bus at the stop of the user", () => {
    expect(approach(route(O, P, P, P, C, F), "4", departureAt, eight)?.away).toBe(0);
  });

  it("ends once the bus has left the stop of the user", () => {
    expect(approach(route(O, P, P, P, P, F), "4", departureAt, eight)).toBeUndefined();
    expect(approach(route(O, P, P, P, P, P), "4", departureAt, eight)).toBeUndefined();
  });

  it("shows fewer stops close to the start of the line", () => {
    expect(uids(approach(route(O, F, F, F, F, F), "1", departureAt - 3 * MIN, eight)?.stops ?? [])).toEqual([
      "0",
      "1",
    ]);
  });

  it("shows nothing at the first stop", () => {
    expect(approach(route(O, F, F, F, F, F), "0", departureAt, eight)).toBeUndefined();
  });

  it("knows the bus of the timer is far when the routing shows another run", () => {
    const result = approach(route(O, P, P, P, C, F), "4", departureAt + 15 * MIN, eight);
    expect(uids(result?.stops ?? [])).toEqual(["2", "3", "4"]);
    expect(result?.away).toBeUndefined();
  });

  it("follows the bus late within a few minutes", () => {
    expect(approach(route(O, P, C, F, F, F), "4", departureAt - 2 * MIN, eight)?.away).toBe(2);
  });
});
