import { describe, expect, it } from "vitest";
import { easterSunday, isTicinoHoliday, timetableYear } from "../calendar";

describe("easterSunday", () => {
  it("finds Easter of the Gregorian calendar", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2038)).toBe("2038-04-25");
  });
});

describe("isTicinoHoliday", () => {
  it("knows the holidays of Ticino in 2026", () => {
    const holidays = [
      "2026-01-01",
      "2026-01-06",
      "2026-03-19",
      "2026-04-06",
      "2026-05-01",
      "2026-05-14",
      "2026-05-25",
      "2026-06-04",
      "2026-06-29",
      "2026-08-01",
      "2026-08-15",
      "2026-11-01",
      "2026-12-08",
      "2026-12-25",
      "2026-12-26",
    ];
    for (const date of holidays) expect(isTicinoHoliday(date), date).toBe(true);
  });

  it("leaves the working days alone", () => {
    // Good Friday, Easter Sunday is a Sunday anyway, Christmas Eve
    for (const date of ["2026-04-03", "2026-10-16", "2026-12-24", "2026-12-31"]) {
      expect(isTicinoHoliday(date), date).toBe(false);
    }
  });

  it("moves the holidays with Easter", () => {
    // Easter 2027 is on 28 March
    expect(isTicinoHoliday("2027-03-29")).toBe(true);
    expect(isTicinoHoliday("2027-05-06")).toBe(true);
    expect(isTicinoHoliday("2027-04-06")).toBe(false);
  });
});

describe("timetableYear", () => {
  it("changes on the Sunday after the second Saturday of December", () => {
    expect(timetableYear("2023-12-09")).toBe(2023);
    expect(timetableYear("2023-12-10")).toBe(2024);
    expect(timetableYear("2024-12-14")).toBe(2024);
    expect(timetableYear("2024-12-15")).toBe(2025);
    expect(timetableYear("2025-12-13")).toBe(2025);
    expect(timetableYear("2025-12-14")).toBe(2026);
    expect(timetableYear("2026-12-12")).toBe(2026);
    expect(timetableYear("2026-12-13")).toBe(2027);
  });

  it("keeps the timetable of the year before until December", () => {
    expect(timetableYear("2026-01-01")).toBe(2026);
    expect(timetableYear("2026-10-16")).toBe(2026);
    expect(timetableYear("2026-12-31")).toBe(2027);
  });
});
