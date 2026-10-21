import { describe, expect, it } from "vitest";
import { messages } from "~/i18n/messages";
import { formatDuration, formatSpeed, formatWeather, journeyTowns } from "../format";

// The Italian texts: the words asserted below
const m = messages.it;

describe("formatDuration", () => {
  it("shows minutes, then hours", () => {
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(66 * 60_000)).toBe("1 h 06");
    expect(formatDuration(-5)).toBe("0 min");
  });
});

describe("formatWeather", () => {
  it("shows the minutes added by the weather", () => {
    expect(formatWeather(m, { kind: "rain", minutes: 2 })).toBe("Pioggia +2 min");
    expect(formatWeather(m, undefined)).toBeUndefined();
  });
});

describe("formatSpeed", () => {
  it("shows km/h with a decimal comma", () => {
    expect(formatSpeed(m, 1.3)).toBe("4,7 km/h");
    expect(formatSpeed(m, 1.5)).toBe("5,4 km/h");
  });
});

describe("journeyTowns", () => {
  it("puts each town under its stop, once, and none already in the name of the stop", () => {
    expect(journeyTowns("Lugano, Centro", "Muzzano, Uovo di Manno")).toEqual({
      from: "Lugano",
      to: "Muzzano",
    });
    expect(journeyTowns("Lugano, Stazione", "Lugano, Cimitero")).toEqual({ from: "Lugano" });
    expect(journeyTowns("Bellinzona", "Lugano, Via Brentani")).toEqual({ to: "Lugano" });
    expect(journeyTowns("Lugano, Via Brentani", "Bellinzona")).toEqual({ from: "Lugano" });
    expect(journeyTowns("Zürich HB", "Airolo")).toEqual({});
  });
});
