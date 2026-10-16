import { describe, expect, it } from "vitest";
import { InTimeStatus, type Departure } from "../models";
import {
  addSample,
  type DelaySample,
  delayKey,
  delayStats,
  MAX_SAMPLES,
  observeDelay,
  percentile,
  recentSamples,
  scheduledInstant,
  serviceDay,
} from "../reliability";

// Friday 16 October 2026, summer time in Lugano (UTC+2)
const at = (iso: string) => Date.parse(iso);

const departure = (Time: string, DepartureAt?: number): Departure => ({
  Target: "486",
  Route: "12",
  RouteCode: "2",
  Dir: "1",
  Routing: "77",
  Dest: "Lugano",
  Img: "2.jpg",
  Time,
  Pred: InTimeStatus.OnTime,
  ...(DepartureAt === undefined ? {} : { DepartureAt }),
});

describe("scheduledInstant", () => {
  it("reads the time on the clocks of Lugano", () => {
    expect(scheduledInstant("07:42", at("2026-10-16T05:44:30Z"))).toBe(
      at("2026-10-16T05:42:00Z")
    );
    // Winter time (UTC+1)
    expect(scheduledInstant("07:42", at("2026-12-16T06:45:00Z"))).toBe(
      at("2026-12-16T06:42:00Z")
    );
  });

  it("takes the nearest day around midnight", () => {
    // A 23:58 bus expected at 00:03 is the one of the evening before
    expect(scheduledInstant("23:58", at("2026-10-16T22:03:00Z"))).toBe(
      at("2026-10-16T21:58:00Z")
    );
    expect(scheduledInstant("00:02", at("2026-10-16T21:59:00Z"))).toBe(
      at("2026-10-16T22:02:00Z")
    );
  });

  it("follows the change of daylight saving time", () => {
    // 25 October 2026: 03:00 summer time becomes 02:00 winter time
    expect(scheduledInstant("05:00", at("2026-10-25T00:30:00Z"))).toBe(
      at("2026-10-25T04:00:00Z")
    );
    // 29 March 2026: 02:00 winter time becomes 03:00 summer time
    expect(scheduledInstant("01:30", at("2026-03-29T01:30:00Z"))).toBe(
      at("2026-03-29T00:30:00Z")
    );
  });

  it("rejects malformed times", () => {
    expect(scheduledInstant("7.42", 0)).toBeUndefined();
    expect(scheduledInstant("25:00", 0)).toBeUndefined();
  });
});

describe("serviceDay", () => {
  it("tells weekdays, Saturdays and Sundays apart in Lugano", () => {
    expect(serviceDay("07:42", at("2026-10-16T05:00:00Z"))).toEqual({
      date: "2026-10-16",
      dayType: "weekday",
    });
    expect(serviceDay("07:42", at("2026-10-17T05:00:00Z"))).toEqual({
      date: "2026-10-17",
      dayType: "saturday",
    });
    expect(serviceDay("07:42", at("2026-10-18T05:00:00Z"))).toEqual({
      date: "2026-10-18",
      dayType: "sunday",
    });
  });

  it("uses the day of the timetable, not of UTC", () => {
    // 00:30 of Saturday in Lugano is still Friday in UTC
    expect(serviceDay("00:30", at("2026-10-16T22:20:00Z"))).toEqual({
      date: "2026-10-17",
      dayType: "saturday",
    });
    // The Friday 23:58 bus late after midnight stays a Friday
    expect(serviceDay("23:58", at("2026-10-16T22:05:00Z"))).toEqual({
      date: "2026-10-16",
      dayType: "weekday",
    });
  });
});

describe("observeDelay", () => {
  const now = at("2026-10-16T05:43:00Z");

  it("keeps the delay of a bus about to leave", () => {
    expect(observeDelay(departure("07:42", at("2026-10-16T05:44:35Z")), now)).toEqual({
      key: "weekday:486:12:1:07:42",
      sample: { date: "2026-10-16", delay: 155 },
    });
    // Early
    expect(
      observeDelay(departure("07:45", at("2026-10-16T05:44:30Z")), now)?.sample.delay
    ).toBe(-30);
  });

  it("ignores buses still far away or without an estimate", () => {
    expect(observeDelay(departure("07:50", at("2026-10-16T05:50:00Z")), now)).toBeUndefined();
    expect(observeDelay(departure("07:42"), now)).toBeUndefined();
  });

  it("ignores delays that can only be another run", () => {
    expect(observeDelay(departure("06:20", at("2026-10-16T05:44:00Z")), now)).toBeUndefined();
    expect(observeDelay(departure("08:00", at("2026-10-16T05:44:00Z")), now)).toBeUndefined();
  });
});

describe("delayKey", () => {
  it("keys by platform, line, direction, time and type of day", () => {
    expect(
      delayKey({ target: "486", route: "12", dir: "2", time: "18:05" }, "saturday")
    ).toBe("saturday:486:12:2:18:05");
  });
});

describe("addSample", () => {
  it("keeps one sample per day, the latest", () => {
    const samples = addSample(
      addSample([], { date: "2026-10-15", delay: 30 }),
      { date: "2026-10-16", delay: 60 }
    );
    expect(addSample(samples, { date: "2026-10-16", delay: 90 })).toEqual([
      { date: "2026-10-15", delay: 30 },
      { date: "2026-10-16", delay: 90 },
    ]);
  });

  it("drops the days out of the window", () => {
    const samples: Array<DelaySample> = [
      { date: "2026-08-17", delay: 10 },
      { date: "2026-08-18", delay: 20 },
    ];
    expect(addSample(samples, { date: "2026-10-16", delay: 30 })).toEqual([
      { date: "2026-08-18", delay: 20 },
      { date: "2026-10-16", delay: 30 },
    ]);
  });

  it("caps the samples", () => {
    const many = Array.from({ length: MAX_SAMPLES + 10 }, (_, day) => ({
      date: "2026-10-16",
      delay: day,
    }));
    expect(recentSamples(many, "2026-10-16")).toHaveLength(MAX_SAMPLES);
  });
});

describe("recentSamples", () => {
  it("ignores samples dated after today", () => {
    expect(
      recentSamples(
        [
          { date: "2026-10-17", delay: 10 },
          { date: "2026-10-01", delay: 20 },
        ],
        "2026-10-16"
      )
    ).toEqual([{ date: "2026-10-01", delay: 20 }]);
  });
});

describe("percentile", () => {
  it("is always one of the values, by nearest rank", () => {
    expect(percentile([10, 20, 30, 40, 50], 0.8)).toBe(40);
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
  });

  it("works with few samples", () => {
    expect(percentile([], 0.8)).toBeUndefined();
    expect(percentile([42], 0.8)).toBe(42);
    expect(percentile([10, 20], 0.8)).toBe(20);
    expect(percentile([10, 20], 0)).toBe(10);
  });
});

describe("delayStats", () => {
  it("summarizes the days", () => {
    const samples = [0, 30, 60, 150, 200].map((delay, day) => ({
      date: `2026-10-0${day + 1}`,
      delay,
    }));
    expect(delayStats(samples)).toEqual({
      samples: 5,
      median: 60,
      p80: 150,
      lateShare: 0.4,
    });
  });

  it("has no figures without samples", () => {
    expect(delayStats([])).toEqual({ samples: 0 });
  });
});
