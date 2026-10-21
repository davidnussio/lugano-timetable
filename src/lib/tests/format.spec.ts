import { describe, expect, it } from "vitest";
import { messages } from "~/i18n/messages";
import { formatDuration, formatSpeed, formatWeather } from "../format";

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
