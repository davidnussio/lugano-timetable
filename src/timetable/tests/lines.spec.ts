import { describe, expect, it } from "vitest";
import { compareCodes, isLineSeed, type LineSeed, linesOf, seedsOf } from "../lines";
import { InTimeStatus } from "../models";

const seed = (route: string, dir: string, routing: string, code = route): LineSeed => ({
  route,
  dir,
  routing,
  target: "100",
  code,
  img: `${code}.jpg`,
  dest: `Dest ${dir}`,
});

describe("seedsOf", () => {
  it("keeps one seed per line, direction and routing", () => {
    const itinerary = {
      Target: "100",
      Route: "23",
      RouteCode: "6",
      Dir: "1",
      Routing: "5",
      Dest: "Brè",
      Img: "6.jpg",
      Time: "08:00",
      Pred: InTimeStatus.OnTime,
    };
    expect(seedsOf([itinerary, { ...itinerary, Time: "08:10" }, { ...itinerary, Route: "x" }]))
      .toEqual([{
        route: "23",
        dir: "1",
        routing: "5",
        target: "100",
        code: "6",
        img: "6.jpg",
        dest: "Brè",
      }]);
  });
});

describe("isLineSeed", () => {
  it("refuses values without digits for the parameters", () => {
    expect(isLineSeed(seed("23", "1", "5"))).toBe(true);
    expect(isLineSeed({ ...seed("23", "1", "5"), target: "1,2" })).toBe(false);
    expect(isLineSeed(null)).toBe(false);
  });
});

describe("linesOf", () => {
  it("takes the routing seen most often in each direction, lines in order", () => {
    const lines = linesOf([
      { seed: seed("30", "1", "1", "10"), hits: 1 },
      { seed: seed("23", "2", "7", "6"), hits: 2 },
      { seed: seed("23", "1", "5", "6"), hits: 9 },
      { seed: seed("23", "1", "6", "6"), hits: 3 },
      { seed: seed("40", "1", "1", "N1"), hits: 1 },
    ]);
    expect(lines.map((line) => line.code)).toEqual(["6", "10", "N1"]);
    expect(lines[0].directions.map((d) => [d.dir, d.routing])).toEqual([
      ["1", "5"],
      ["2", "7"],
    ]);
  });
});

describe("compareCodes", () => {
  it("orders the numbers as numbers", () => {
    expect(["10", "2", "N1", "6"].sort(compareCodes)).toEqual(["2", "6", "10", "N1"]);
  });
});
