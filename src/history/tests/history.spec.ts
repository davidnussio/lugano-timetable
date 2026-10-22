import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import { type ActiveTimer, createJourneyTimer, createTimer } from "~/timer/store";
import { isActiveTimer } from "~/timer/valid";
import { InTimeStatus } from "~/timetable/models";
import {
  choices,
  delaySummary,
  groupBy,
  historyTotals,
  rideSamples,
  sampleTrips,
  timeOfDay,
  weatherOf,
} from "../query";
import { addTrip, MAX_TRIPS, type TripRecord, tripRecord } from "../trip";
import { isTripRecord, validTrips } from "../valid";

const MIN = 60_000;
// Thursday 15 January 2026, 08:00 in Lugano (UTC+1)
const EIGHT = Date.UTC(2026, 0, 15, 7, 0);
const at = (minutes: number) => EIGHT + minutes * MIN;

const snow = { precipitation: 1.2, snowfall: 0.8, code: 73, kind: "snow" } as const;

// Bus 6 from Via Brentani at 08:10, leaving at 08:13
const single = (patch: Partial<ActiveTimer> = {}): ActiveTimer => ({
  ...createTimer(
    {
      Target: "12",
      Route: "6",
      RouteCode: "6",
      Dir: "1",
      Routing: "586",
      Dest: "Lugano, Stazione",
      Img: "6.jpg",
      Time: "08:10",
      Pred: InTimeStatus.Delayed,
      DepartureAt: at(13),
    },
    { name: "Via Brentani", label: "Lugano, Via Brentani", identifiers: ["12"] },
    { Id: "12", Lat: 46.0135, Lon: 8.9465 },
    at(0)
  ),
  ...patch,
});

const station = (id: string, name: string): Station => ({ id, name });
const brentani = station("8591425", "Lugano, Via Brentani");
const stazione = station("8591260", "Lugano, Stazione");
const lugano = station("8505300", "Lugano");
const bellinzona = station("8505213", "Bellinzona");

const leg = (
  line: string,
  from: Station,
  to: Station,
  departure: number,
  arrival: number,
  late?: number
): PlannedLeg => ({
  trip: `00${line}000`,
  category: line.startsWith("S") ? "S" : "B",
  line,
  operator: line.startsWith("S") ? "SBB" : "TPL",
  destination: to.name,
  from,
  to,
  departure: {
    scheduled: at(departure),
    ...(late === undefined ? {} : { estimated: at(departure + late) }),
  },
  arrival: {
    scheduled: at(arrival),
    ...(late === undefined ? {} : { estimated: at(arrival + late) }),
  },
});

// Bus 6 at 08:10 (a minute late), then the S10 to Bellinzona at 08:25
const connection: Connection = {
  legs: [leg("6", brentani, stazione, 10, 18, 1), leg("S10", lugano, bellinzona, 25, 45)],
  walkAfterMs: 4 * MIN,
};

describe("tripRecord", () => {
  it("keeps nothing before the bus has left", () => {
    expect(tripRecord(single(), { now: at(12), pace: "normal" })).toBeUndefined();
  });

  it("records a single bus with its delay, the walk, the wait and the weather", () => {
    const timer = single({
      atStop: { at: at(8), leftAt: at(2), meters: 420 },
      getOff: { target: "40", name: "Lugano, Stazione", arrivedAt: at(21), alerted: [] },
      weather: snow,
      fired: [5],
    });
    const trip = tripRecord(timer, { now: at(40), pace: "fast" });
    expect(trip).toEqual({
      id: at(0),
      kind: "bus",
      startedAt: at(0),
      endedAt: at(21),
      completed: true,
      date: "2026-01-15",
      dayType: "weekday",
      holiday: false,
      hour: 8,
      from: "Lugano, Via Brentani",
      to: "Lugano, Stazione",
      rides: [
        {
          line: "6",
          destination: "Lugano, Stazione",
          from: "Lugano, Via Brentani",
          to: "Lugano, Stazione",
          departure: { scheduled: at(10), actual: at(13) },
          arrival: { actual: at(21) },
        },
      ],
      walk: { leftAt: at(2), ms: 6 * MIN, meters: 420 },
      waitMs: 5 * MIN,
      durationMs: 19 * MIN,
      weather: snow,
      pace: "fast",
      alerts: 1,
    });
    expect(isTripRecord(trip)).toBe(true);
  });

  it("records the legs of a journey ridden so far when stopped on the way", () => {
    const timer = createJourneyTimer(connection, brentani, bellinzona, undefined, at(0));
    const trip = tripRecord(timer, { now: at(20), pace: "normal" });
    expect(trip?.completed).toBe(false);
    expect(trip?.endedAt).toBe(at(20));
    expect(trip?.rides.map((ride) => ride.line)).toEqual(["6"]);
    expect(trip?.rides[0].departure).toEqual({ scheduled: at(10), actual: at(11) });
    expect(trip?.walkAfterMs).toBeUndefined();
  });

  it("counts the walk to the destination once a journey is over", () => {
    const timer = createJourneyTimer(connection, brentani, bellinzona, undefined, at(0));
    const trip = tripRecord(timer, { now: at(60), pace: "normal" });
    expect(trip?.completed).toBe(true);
    expect(trip?.to).toBe("Bellinzona");
    expect(trip?.rides.map((ride) => ride.line)).toEqual(["6", "S10"]);
    expect(trip?.walkAfterMs).toBe(4 * MIN);
    expect(trip?.endedAt).toBe(at(49));
  });

  it("takes the departure of the first bus from the real-time data of its stop", () => {
    const timer = {
      ...createJourneyTimer(connection, brentani, bellinzona, undefined, at(0)),
      routing: "586",
      departureAt: at(12),
    };
    const trip = tripRecord(timer, { now: at(60), pace: "normal" });
    expect(trip?.rides[0].departure).toEqual({ scheduled: at(10), actual: at(12) });
  });

  it("tells the holidays of Ticino, run as Sundays", () => {
    // Epiphany, a Tuesday
    const epiphany = Date.UTC(2026, 0, 6, 7, 0);
    const timer = single({ departureAt: epiphany + 13 * MIN, startedAt: epiphany });
    const trip = tripRecord(timer, { now: epiphany + 20 * MIN, pace: "normal" });
    expect(trip).toMatchObject({ date: "2026-01-06", dayType: "sunday", holiday: true });
  });

  it("keeps the weather with the timer read back from storage", () => {
    expect(isActiveTimer(single({ weather: snow }))).toBe(true);
    expect(isActiveTimer({ ...single(), weather: { kind: "snow" } })).toBe(false);
  });
});

const trip = (
  minutes: number,
  { line = "6", late = 0, weather }: { line?: string; late?: number; weather?: typeof snow }
): TripRecord => {
  const timer = single({
    startedAt: at(minutes),
    line,
    time: new Date(at(minutes + 10)).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    }),
    departureAt: at(minutes + 10 + late),
    ...(weather === undefined ? {} : { weather }),
  });
  const record = tripRecord(timer, { now: at(minutes + 60), pace: "normal" });
  if (record === undefined) throw new Error("no trip");
  return record;
};

describe("addTrip", () => {
  it("replaces the trip of the same timer and drops the oldest", () => {
    const first = trip(0, {});
    const again = { ...first, completed: false };
    expect(addTrip([first], again)).toEqual([again]);
    const many = Array.from({ length: MAX_TRIPS }, (_, index) => trip(index, {}));
    const next = addTrip(many, trip(MAX_TRIPS, {}));
    expect(next).toHaveLength(MAX_TRIPS);
    expect(next[0].id).toBe(at(1));
  });

  it("drops the trips of another shape, not the whole history", () => {
    expect(validTrips([trip(0, {}), { id: "old" }, null])).toHaveLength(1);
    expect(validTrips({})).toEqual([]);
  });
});

describe("questions to the history", () => {
  const history = [
    trip(0, { late: 4, weather: snow }),
    trip(60, { late: 2, weather: snow }),
    trip(120, { late: 6, weather: snow }),
    trip(180, { late: 0, weather: { precipitation: 0, snowfall: 0, code: 0 } as never }),
    trip(240, { line: "2", late: 1 }),
  ];

  it("answers how late the 6 leaves Via Brentani when it snows", () => {
    const samples = rideSamples(history, {
      line: "6",
      stop: "Lugano, Via Brentani",
      weather: "snow",
    });
    expect(delaySummary(samples)).toEqual({
      rides: 3,
      measured: 3,
      mean: 4 * MIN,
      median: 4 * MIN,
      p80: 6 * MIN,
      max: 6 * MIN,
      lateShare: 2 / 3,
      onTimeShare: 0,
    });
  });

  it("tells dry from unknown weather", () => {
    expect(weatherOf(history[3])).toBe("dry");
    expect(weatherOf(history[4])).toBeUndefined();
    expect(rideSamples(history, { weather: "dry" })).toHaveLength(1);
    expect(rideSamples(history, { weather: "wet" })).toHaveLength(3);
  });

  it("filters by the hour of the departure", () => {
    expect(timeOfDay(8)).toBe("morning");
    expect(timeOfDay(17)).toBe("evening");
    expect(timeOfDay(23)).toBe("late");
    expect(timeOfDay(3)).toBe("night");
    // 08:10 and 09:10, 10:10…
    expect(rideSamples(history, { time: "morning" })).toHaveLength(1);
    expect(rideSamples(history, { time: "day" })).toHaveLength(4);
  });

  it("groups the delays by weather", () => {
    const groups = groupBy(rideSamples(history, { line: "6" }), ["dry", "snow", "rain"], (s) =>
      weatherOf(s.trip)
    );
    expect(groups.map((group) => [group.key, group.summary.median])).toEqual([
      ["dry", 0],
      ["snow", 4 * MIN],
    ]);
  });

  it("lists the trips latest first and sums them up", () => {
    const samples = rideSamples(history, { line: "6" });
    expect(sampleTrips(samples).map((each) => each.id)).toEqual([
      at(180),
      at(120),
      at(60),
      at(0),
    ]);
    expect(historyTotals(history)).toMatchObject({ trips: 5, rides: 5, walkMeters: 0 });
    expect(choices(["6", "2", "6", "10"])).toEqual(["6", "2", "10"]);
  });

  it("leaves a delay out without a time of the timetable", () => {
    const [record] = history;
    const noSchedule: TripRecord = {
      ...record,
      rides: [{ ...record.rides[0], departure: { actual: at(13) } }],
    };
    expect(delaySummary(rideSamples([noSchedule]))).toEqual({ rides: 1, measured: 0 });
  });
});
