import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type FilterLine,
  filterDepartures,
  lineChips,
  lineFilterStore,
  stopKey,
  toggleLine,
  withLines,
} from "../line-filter";
import { type Departure, InTimeStatus } from "../models";

const departure = (route: string, line: string, dest = "Centro"): Departure => ({
  Target: "100",
  Route: route,
  RouteCode: line,
  Dir: "1",
  Routing: "1",
  Dest: dest,
  Img: `${route}.jpg`,
  Time: "08:00",
  Pred: InTimeStatus.OnTime,
});

const line = (route: string, name: string): FilterLine => ({
  route,
  line: name,
  img: `${route}.jpg`,
});

const departures = [
  departure("23", "5", "Vezia"),
  departure("19", "1"),
  departure("23", "5", "Centro"),
  departure("32", "10"),
];

describe("lineChips", () => {
  it("lists each line once, by name", () => {
    expect(lineChips(departures, []).map((chip) => chip.line)).toEqual(["1", "5", "10"]);
    expect(lineChips(departures, []).every((chip) => !chip.selected && !chip.absent)).toBe(
      true
    );
  });

  it("keeps the chosen lines without departures, marked absent", () => {
    const chips = lineChips(departures, [line("23", "5"), line("29", "8")]);
    expect(chips.map(({ line, selected, absent }) => [line, selected, absent])).toEqual([
      ["1", false, false],
      ["5", true, false],
      ["8", true, true],
      ["10", false, false],
    ]);
  });
});

describe("filterDepartures", () => {
  it("keeps everything without a choice", () => {
    expect(filterDepartures(departures, [])).toBe(departures);
  });

  it("keeps the chosen lines in both directions, in order", () => {
    expect(
      filterDepartures(departures, [line("32", "10"), line("23", "5")]).map(
        (departure) => `${departure.RouteCode} ${departure.Dest}`
      )
    ).toEqual(["5 Vezia", "5 Centro", "10 Centro"]);
  });

  it("can leave nothing when the chosen lines do not run now", () => {
    expect(filterDepartures(departures, [line("29", "8")])).toEqual([]);
  });
});

describe("toggleLine", () => {
  it("adds and removes a line, keeping the others", () => {
    const chosen = toggleLine(toggleLine([], line("23", "5")), line("19", "1"));
    expect(chosen.map((line) => line.route)).toEqual(["23", "19"]);
    expect(toggleLine(chosen, line("23", "5")).map((line) => line.route)).toEqual(["19"]);
  });

  it("stores only the line, not the chip state", () => {
    const [chip] = lineChips(departures, []);
    expect(toggleLine([], chip)).toEqual([line("19", "1")]);
  });
});

describe("withLines", () => {
  it("sets the lines of a stop and drops it once empty", () => {
    const key = stopKey(["100", "101"]);
    expect(key).toBe("100,101");
    const filters = withLines({ other: [line("19", "1")] }, key, [line("23", "5")]);
    expect(filters).toEqual({ other: [line("19", "1")], [key]: [line("23", "5")] });
    expect(withLines(filters, key, [])).toEqual({ other: [line("19", "1")] });
  });
});

describe("lineFilterStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops a stored value of another shape", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
    });
    storage.set("lugano-timetable-line-filter", JSON.stringify({ "100": ["5"] }));
    expect(lineFilterStore.get()).toEqual({});
    storage.set("lugano-timetable-line-filter", JSON.stringify({ "100": [line("23", "5")] }));
    expect(lineFilterStore.get()).toEqual({ "100": [line("23", "5")] });
  });
});
