import { describe, expect, it } from "vitest";
import { InTimeStatus, type Departure, type Target } from "~/timetable/models";
import { closestPlatform, findLegDeparture, isTplLeg, tplStop } from "../tpl";

const MIN = 60_000;

const targets: ReadonlyArray<Target> = [
  {
    Name: "Centro",
    Label: "Lugano, Centro",
    Identifiers: ["12", "13"],
    Coordinates: [
      { Id: "12", Lat: 46.00598, Lon: 8.95245 },
      { Id: "13", Lat: 46.00495, Lon: 8.95153 },
    ],
    CodeNat: "8591603",
  },
  {
    Name: "Ai Frati",
    Label: "Lugano, ai Frati",
    Identifiers: ["486"],
    Coordinates: [],
  },
];

const departure = (RouteCode: string, minutes?: number, Uid?: number): Departure => ({
  Target: "12",
  Route: "20",
  RouteCode,
  Dir: "1",
  Routing: "586",
  Dest: "Paradiso",
  Img: "20.jpg",
  Time: "08:00",
  Pred: InTimeStatus.OnTime,
  ...(minutes === undefined ? {} : { DepartureAt: minutes * MIN }),
  ...(Uid === undefined ? {} : { Uid }),
});

describe("isTplLeg", () => {
  it("recognises the TPL operator", () => {
    expect(isTplLeg({ operator: "TPL" })).toBe(true);
    expect(isTplLeg({ operator: "tpl" })).toBe(true);
    expect(isTplLeg({ operator: "ARL" })).toBe(false);
    expect(isTplLeg({})).toBe(false);
  });
});

describe("tplStop", () => {
  it("finds the stop by national code", () => {
    expect(tplStop(targets, "8591603")).toBe(targets[0]);
    expect(tplStop(targets, "8505300")).toBeUndefined();
    expect(tplStop(undefined, "8591603")).toBeUndefined();
  });
});

describe("closestPlatform", () => {
  it("picks the platform nearest to the planned stop", () => {
    expect(closestPlatform(targets[0], { lat: 46.0049, lon: 8.9515 })?.Id).toBe("13");
    expect(closestPlatform(targets[0], undefined)?.Id).toBe("12");
    expect(closestPlatform(targets[1], { lat: 46, lon: 8.9 })).toBeUndefined();
  });
});

describe("findLegDeparture", () => {
  it("picks the run of the same line closest to the expected time", () => {
    const departures = [
      departure("2", 10, 1),
      departure("5", 12, 2),
      departure("2", 25, 3),
      departure("5", 27, 4),
    ];
    expect(findLegDeparture(departures, "5", 14 * MIN)?.Uid).toBe(2);
    expect(findLegDeparture(departures, "5", 24 * MIN)?.Uid).toBe(4);
  });

  it("ignores runs too far from the plan and departures without time", () => {
    expect(findLegDeparture([departure("5", 40)], "5", 10 * MIN)).toBeUndefined();
    expect(findLegDeparture([departure("5")], "5", 0)).toBeUndefined();
  });

  it("compares line names loosely", () => {
    expect(findLegDeparture([departure("n1 ", 5)], "N1", 5 * MIN)).toBeDefined();
  });
});
