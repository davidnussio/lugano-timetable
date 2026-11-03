import { describe, expect, it } from "vitest";
import { compareCodes, hexColor, toLines } from "../lines";

// Trimmed GETROUTES and GETTARGETS answers, as read by the official app:
// the types of the values are not documented
const routes = [
  { Uid: 30, ShortCode: "10", Backcolor: "FEC43B", Forecolor: "#000000" },
  { Uid: "23", Code: "06", ShortCode: "6", Description: "Cornaredo - Breganzona", Backcolor: "#005F9A" },
  { Uid: "40", Code: "N1" },
  { Code: "no uid" },
];

const target = (Name: string, ...platforms: Array<[string, Array<[unknown, unknown, string]>]>) => ({
  Name,
  Identifiers: platforms.map(([Id, directions]) => ({
    Id,
    Basin: "TPL",
    RoutesDirections: directions.map(([uid, dir, des]) => ({ uid, dir, des })),
  })),
});

const targets = [
  target("Breganzona", ["901", [["23", "1", "Breganzona"]]]),
  target("Cornaredo", ["101", [["23", "1", "Breganzona"]]], ["102", [["23", 2, "Cornaredo"]]]),
  target("Centro", ["501", [["23", "1", "Breganzona"], [30, "1", "Paradiso"]]], ["502", [["23", "2", "Cornaredo"]]]),
  target("Besso", ["601", [["23", "1", "Besso"]]]),
];

describe("toLines", () => {
  const lines = toLines(routes, targets);

  it("lists the lines by their number, with their colors", () => {
    expect(lines.map((line) => [line.route, line.code, line.color, line.textColor])).toEqual([
      ["23", "6", "#005f9a", undefined],
      ["30", "10", "#fec43b", "#000000"],
      ["40", "N1", undefined, undefined],
    ]);
    expect(lines[0].description).toBe("Cornaredo - Breganzona");
  });

  it("gives each direction its platforms, the end of the line last", () => {
    expect(lines[0].directions).toEqual([
      { dir: "1", dest: "Breganzona", targets: ["101", "501", "601", "901"] },
      { dir: "2", dest: "Cornaredo", targets: ["502", "102"] },
    ]);
    expect(lines[2].directions).toEqual([]);
  });
});

describe("hexColor", () => {
  it("reads the colors with or without #", () => {
    expect(hexColor("FEC43B")).toBe("#fec43b");
    expect(hexColor("0x00ff00")).toBe("#00ff00");
    expect(hexColor("#fff")).toBe("#fff");
    expect(hexColor("red")).toBeUndefined();
    expect(hexColor(undefined)).toBeUndefined();
  });
});

describe("compareCodes", () => {
  it("orders the numbers as numbers", () => {
    expect(["10", "2", "N1", "6"].sort(compareCodes)).toEqual(["2", "6", "10", "N1"]);
  });
});
