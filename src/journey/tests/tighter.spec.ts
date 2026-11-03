import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "../models";
import {
  probeKey,
  splice,
  transferProbes,
  withTighterTransfers,
} from "../tighter";

const minutes = (hours: number, min: number) => Date.UTC(2026, 10, 4, hours, min);

const stop = (id: string): Station => ({ id, name: id });

const leg = (
  trip: string,
  from: string,
  departure: number,
  to: string,
  arrival: number,
  walkBeforeMs?: number
): PlannedLeg => ({
  trip,
  category: "B",
  line: trip,
  destination: to,
  from: stop(from),
  to: stop(to),
  departure: { scheduled: departure },
  arrival: { scheduled: arrival },
  ...(walkBeforeMs === undefined ? {} : { walkBeforeMs }),
});

const bus = leg("bus", "brentani", minutes(5, 46), "nord", minutes(5, 52));
const s10 = leg("s10", "lugano", minutes(6, 3), "bellinzona", minutes(6, 31), 300_000);
const ic2 = leg("ic2", "lugano", minutes(6, 0), "bellinzona", minutes(6, 13));
const routed: Connection = { legs: [bus, s10] };
const probe = { from: "lugano", at: minutes(5, 52) };

describe("transferProbes", () => {
  it("searches again from the stop of a long wait", () => {
    expect(transferProbes([routed])).toEqual([probe]);
  });

  it("skips the transfers without time to wait", () => {
    const quick = { ...s10, departure: { scheduled: minutes(5, 54) } };
    expect(transferProbes([{ legs: [bus, quick] }])).toEqual([]);
    expect(transferProbes([{ legs: [bus] }])).toEqual([]);
  });

  it("searches a stop and minute once", () => {
    expect(transferProbes([routed, routed])).toHaveLength(1);
  });
});

describe("splice", () => {
  it("takes the earlier train that can still be caught", () => {
    const spliced = splice(routed, 0, [{ legs: [ic2] }, { legs: [s10] }]);
    expect(spliced?.legs.map((l) => l.trip)).toEqual(["bus", "ic2"]);
    // The walk of the router to the platforms stays
    expect(spliced?.legs[1].walkBeforeMs).toBe(300_000);
  });

  it("leaves out the trains left before the walk ends", () => {
    const early = { ...ic2, departure: { scheduled: minutes(5, 56) } };
    expect(splice(routed, 0, [{ legs: [early] }])).toBeUndefined();
  });

  it("leaves out the connections arriving no earlier", () => {
    expect(splice(routed, 0, [{ legs: [s10] }])).toBeUndefined();
  });

  it("leaves out the connections starting elsewhere", () => {
    const elsewhere = { ...ic2, from: stop("paradiso") };
    expect(splice(routed, 0, [{ legs: [elsewhere] }])).toBeUndefined();
  });
});

describe("withTighterTransfers", () => {
  it("adds the faster connection before the one of the router", () => {
    const found = new Map([[probeKey(probe), [{ legs: [ic2] }]]]);
    const result = withTighterTransfers([routed], found);
    expect(result.map((c) => c.legs.map((l) => l.trip))).toEqual([
      ["bus", "ic2"],
      ["bus", "s10"],
    ]);
  });

  it("keeps the connections when nothing better is found", () => {
    const connections = [routed];
    expect(withTighterTransfers(connections, new Map())).toBe(connections);
  });
});
