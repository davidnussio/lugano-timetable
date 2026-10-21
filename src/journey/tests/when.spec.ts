import { describe, expect, it } from "vitest";
import { arrivalTime, NOW, searchAt, zurichAt, zurichTime } from "../when";

// Tuesday 20 October 2026, 10:08 in Lugano (UTC+2)
const now = Date.UTC(2026, 9, 20, 8, 8);

describe("zurichAt", () => {
  it("reads a time in Lugano, on the day chosen", () => {
    expect(zurichAt(0, "08:00", now)).toBe(Date.UTC(2026, 9, 20, 6, 0));
    expect(zurichAt(2, "23:30", now)).toBe(Date.UTC(2026, 9, 22, 21, 30));
    expect(zurichAt(0, "8 h", now)).toBeUndefined();
  });

  it("follows the change of the clocks", () => {
    // Winter time from Sunday 25 October: UTC+1
    expect(zurichAt(6, "08:00", now)).toBe(Date.UTC(2026, 9, 26, 7, 0));
  });

  it("starts the day in Lugano, not in UTC", () => {
    // 00:30 in Lugano is still the day before in UTC
    const night = Date.UTC(2026, 9, 20, 22, 30);
    expect(zurichAt(0, "07:00", night)).toBe(Date.UTC(2026, 9, 21, 5, 0));
  });
});

describe("searchAt", () => {
  it("is now unless a time or another day is chosen", () => {
    expect(searchAt(NOW, now)).toBeUndefined();
    expect(searchAt({ day: 1, arrive: false }, now)).toBe(Date.UTC(2026, 9, 21, 8, 8));
    expect(searchAt({ day: 0, time: "18:15", arrive: true }, now)).toBe(
      Date.UTC(2026, 9, 20, 16, 15)
    );
  });
});

describe("arrivalTime", () => {
  it("rounds an hour from now up to the quarter", () => {
    expect(zurichTime(now)).toBe("10:08");
    expect(arrivalTime(now)).toBe("11:15");
  });
});
