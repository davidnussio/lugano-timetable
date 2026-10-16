import { describe, expect, it } from "vitest";
import { formatDuration, formatSpeed } from "../format";

describe("formatDuration", () => {
  it("shows minutes, then hours", () => {
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(66 * 60_000)).toBe("1 h 06");
    expect(formatDuration(-5)).toBe("0 min");
  });
});

describe("formatSpeed", () => {
  it("shows km/h with a decimal comma", () => {
    expect(formatSpeed(1.3)).toBe("4,7 km/h");
    expect(formatSpeed(1.5)).toBe("5,4 km/h");
  });
});
