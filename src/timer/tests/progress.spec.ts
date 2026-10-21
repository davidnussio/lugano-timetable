import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import { InTimeStatus } from "~/timetable/models";
import { transfer } from "../journey";
import { nextStop, reachStop, travelStats, tripSteps } from "../progress";
import { type ActiveTimer, createJourneyTimer, createTimer } from "../store";

const MIN = 60_000;

const station = (id: string, name: string, lat: number, lon: number): Station => ({
  id,
  name,
  position: { lat, lon },
});
const brentani = station("8591425", "Lugano, Via Brentani", 46.0135, 8.9465);
const stazione = station("8591260", "Lugano, Stazione", 46.0049, 8.9469);
const lugano = station("8505300", "Lugano", 46.0054, 8.9469);
const bellinzona = station("8505213", "Bellinzona", 46.1953, 9.0294);

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
    scheduled: departure * MIN,
    ...(late === undefined ? {} : { estimated: (departure + late) * MIN }),
  },
  arrival: {
    scheduled: arrival * MIN,
    ...(late === undefined ? {} : { estimated: (arrival + late) * MIN }),
  },
});

// Bus 6 from Via Brentani at 10, then the S10 to Bellinzona at 25
const connection: Connection = {
  legs: [
    leg("6", brentani, stazione, 10, 18, 1),
    { ...leg("S10", lugano, bellinzona, 25, 45), walkBeforeMs: 3 * MIN },
  ],
};

const journey = (patch: Partial<ActiveTimer> = {}): ActiveTimer => ({
  ...createJourneyTimer(connection, brentani, bellinzona, undefined, 0),
  ...patch,
});

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
      Pred: InTimeStatus.OnTime,
      DepartureAt: 10 * MIN,
    },
    { name: "Via Brentani", label: "Lugano, Via Brentani", identifiers: ["12"] },
    { Id: "12", Lat: 46.0135, Lon: 8.9465 },
    0
  ),
  ...patch,
});

describe("reachStop", () => {
  const walk = { at: 2 * MIN, meters: 450, climb: 10, pace: "normal", lastAt: 7 * MIN } as const;

  it("keeps the walk that led to the stop", () => {
    expect(reachStop(undefined, "walking", "arrived", walk, { meters: 20, at: 8 * MIN })).toEqual({
      at: 8 * MIN,
      leftAt: 2 * MIN,
      meters: 430,
    });
  });

  it("only knows the arrival when the walk was not followed", () => {
    expect(reachStop(undefined, "away", "arrived", undefined, { meters: 10, at: MIN })).toEqual({
      at: MIN,
    });
    expect(
      reachStop(undefined, "walking", "arrived", { ...walk, spoiled: true }, { meters: 10, at: MIN })
    ).toEqual({ at: MIN });
  });

  it("records the arrival once", () => {
    const first = { at: MIN };
    expect(reachStop(first, "arrived", "arrived", walk, { meters: 5, at: 3 * MIN })).toBe(first);
    expect(reachStop(undefined, "away", "walking", walk, { meters: 200, at: 3 * MIN })).toBe(
      undefined
    );
  });
});

describe("tripSteps", () => {
  const atStop = { at: 7 * MIN, leftAt: MIN, meters: 450 };

  it("tells the walk, the wait and the ride under way", () => {
    const timer = journey({ atStop });
    const steps = tripSteps(timer, timer.journey?.legs, 15 * MIN);
    expect(steps).toEqual([
      { kind: "walk", at: MIN, ms: 6 * MIN, done: true, to: "Lugano, Via Brentani", meters: 450 },
      // The bus left a minute late
      { kind: "wait", at: 7 * MIN, ms: 4 * MIN, done: true, stop: "Lugano, Via Brentani" },
      {
        kind: "ride",
        at: 11 * MIN,
        ms: 4 * MIN,
        done: false,
        index: 0,
        line: "6",
        category: "B",
        operator: "TPL",
        to: "Lugano, Stazione",
        delayMs: MIN,
      },
    ]);
  });

  it("follows the transfers with the walk at the pace of the user", () => {
    const timer = journey({ atStop });
    const legs = timer.journey?.legs ?? [];
    const transfers = [transfer(legs[0], legs[1])];
    const steps = tripSteps(timer, legs, 30 * MIN, { transfers });
    expect(steps.map((step) => [step.kind, step.at / MIN, step.ms / MIN, step.done])).toEqual([
      ["walk", 1, 6, true],
      ["wait", 7, 4, true],
      ["ride", 11, 8, true],
      ["transfer", 19, 6, true],
      ["ride", 25, 5, false],
    ]);
    expect(steps[3]).toMatchObject({ stop: "Lugano, Stazione", walkingMs: transfers[0].walkingMs });
    // The train has no real-time data: no delay to tell
    expect(steps[4]).not.toHaveProperty("delayMs");
  });

  it("waits at the transfer until the next leg leaves", () => {
    const timer = journey();
    const steps = tripSteps(timer, timer.journey?.legs, 21 * MIN);
    expect(steps.map((step) => [step.kind, step.ms / MIN, step.done])).toEqual([
      ["ride", 8, true],
      ["transfer", 2, false],
    ]);
    expect(steps[1]).toMatchObject({ walkingMs: 3 * MIN });
  });

  it("ends with the walk from the last stop to the destination", () => {
    const timer = journey();
    const onFoot = timer.journey && { ...timer.journey, walkAfterMs: 9 * MIN };
    const steps = tripSteps({ ...timer, journey: onFoot }, onFoot?.legs, 50 * MIN);
    expect(steps.at(-1)).toEqual({
      kind: "walk",
      at: 45 * MIN,
      ms: 5 * MIN,
      done: false,
      to: "Bellinzona",
    });
    expect(tripSteps({ ...timer, journey: onFoot }, onFoot?.legs, 60 * MIN).at(-1)).toMatchObject({
      kind: "walk",
      ms: 9 * MIN,
      done: true,
    });
    // At the pace of the user: a slow walk takes longer than planned
    expect(
      tripSteps({ ...timer, journey: onFoot }, onFoot?.legs, 55 * MIN, { walkAfterMs: 12 * MIN }).at(-1)
    ).toMatchObject({ kind: "walk", ms: 10 * MIN, done: false });
    // Without a walk planned the journey ends at the last stop
    expect(tripSteps(timer, timer.journey?.legs, 50 * MIN).at(-1)?.kind).toBe("ride");
  });

  it("has nothing to tell before the stop is reached", () => {
    const timer = journey();
    expect(tripSteps(timer, timer.journey?.legs, 5 * MIN)).toEqual([]);
  });

  it("skips the wait when the stop was reached after the bus left", () => {
    const timer = journey({ atStop: { at: 12 * MIN } });
    expect(tripSteps(timer, timer.journey?.legs, 13 * MIN).map((step) => step.kind)).toEqual([
      "ride",
    ]);
  });

  it("follows a single bus to the stop to get off", () => {
    const getOff = { target: "40", name: "Lugano, Stazione", alerted: [] };
    const riding = single({ atStop: { at: 8 * MIN }, getOff });
    expect(tripSteps(riding, undefined, 14 * MIN)).toEqual([
      { kind: "wait", at: 8 * MIN, ms: 2 * MIN, done: true, stop: "Via Brentani" },
      {
        kind: "ride",
        at: 10 * MIN,
        ms: 4 * MIN,
        done: false,
        index: 0,
        line: "6",
        to: "Lugano, Stazione",
      },
    ]);
    const arrived = single({ getOff: { ...getOff, arrivedAt: 17 * MIN } });
    expect(tripSteps(arrived, undefined, 20 * MIN)).toMatchObject([
      { kind: "ride", ms: 7 * MIN, done: true },
    ]);
    // Without a stop to get off the ride is not followed
    expect(tripSteps(single(), undefined, 14 * MIN)).toEqual([]);
  });
});

describe("nextStop", () => {
  it("leads to the stop of the timer until the bus leaves", () => {
    const timer = journey();
    expect(nextStop(timer, timer.journey?.legs, 5 * MIN)).toBeUndefined();
  });

  it("leads to the stop to get off once on board", () => {
    const timer = journey();
    expect(nextStop(timer, timer.journey?.legs, 15 * MIN)).toEqual({
      kind: "getOff",
      name: "Lugano, Stazione",
      position: stazione.position,
    });
  });

  it("leads to the next bus at a transfer, then to the destination", () => {
    const timer = journey();
    expect(nextStop(timer, timer.journey?.legs, 21 * MIN)).toMatchObject({
      kind: "board",
      name: "Lugano",
    });
    expect(nextStop(timer, timer.journey?.legs, 50 * MIN)).toMatchObject({
      kind: "destination",
      name: "Bellinzona",
    });
  });

  it("leads a single bus to the stop to get off, when known", () => {
    const getOff = {
      target: "40",
      name: "Lugano, Stazione",
      position: stazione.position,
      alerted: [],
    };
    expect(nextStop(single({ getOff }), undefined, 12 * MIN)).toEqual({
      kind: "getOff",
      name: "Lugano, Stazione",
      position: stazione.position,
    });
    expect(nextStop(single({ getOff }), undefined, 8 * MIN)).toBeUndefined();
    expect(nextStop(single(), undefined, 12 * MIN)).toBeUndefined();
    const { position: _, ...unknown } = getOff;
    expect(nextStop(single({ getOff: unknown }), undefined, 12 * MIN)).toBeUndefined();
  });
});

describe("travelStats", () => {
  it("is about the walk until the bus leaves", () => {
    const timer = journey();
    expect(travelStats(timer, timer.journey?.legs, undefined, 5 * MIN)).toBeUndefined();
    expect(travelStats(single(), undefined, undefined, 12 * MIN)).toBeUndefined();
  });

  it("tells the times of the leg on board, with its delay at the arrival", () => {
    const timer = journey();
    expect(travelStats(timer, timer.journey?.legs, undefined, 15 * MIN)).toEqual({
      departureAt: 11 * MIN,
      arrivalAt: 19 * MIN,
      extra: { kind: "delay", ms: MIN },
    });
  });

  it("tells the next departure at a transfer, without a delay unknown", () => {
    const timer = journey();
    expect(travelStats(timer, timer.journey?.legs, undefined, 21 * MIN)).toEqual({
      departureAt: 25 * MIN,
      arrivalAt: 45 * MIN,
      extra: { kind: "delay", ms: undefined },
    });
  });

  it("tells the whole trip once there, or the walk left to the destination", () => {
    const timer = journey();
    expect(travelStats(timer, timer.journey?.legs, undefined, 50 * MIN)).toEqual({
      departureAt: 11 * MIN,
      arrivalAt: 45 * MIN,
      extra: { kind: "duration", ms: 34 * MIN },
    });
    const walking = journey();
    const withWalk = walking.journey && { ...walking.journey, walkAfterMs: 9 * MIN };
    const onFoot = { ...walking, journey: withWalk };
    expect(travelStats(onFoot, withWalk?.legs, undefined, 50 * MIN)?.extra).toEqual({
      kind: "walk",
      ms: 9 * MIN,
    });
    expect(travelStats(onFoot, withWalk?.legs, undefined, 55 * MIN, 12 * MIN)?.extra).toEqual({
      kind: "walk",
      ms: 12 * MIN,
    });
    // Door to door once the walk is over
    expect(travelStats(onFoot, withWalk?.legs, undefined, 55 * MIN)).toEqual({
      departureAt: 11 * MIN,
      arrivalAt: 54 * MIN,
      extra: { kind: "duration", ms: 43 * MIN },
    });
  });

  it("counts the stops left on a single bus, then the ride once there", () => {
    const getOff = { target: "40", name: "Lugano, Stazione", arrivalAt: 18 * MIN, alerted: [] };
    expect(travelStats(single({ getOff }), undefined, 3, 12 * MIN)).toEqual({
      departureAt: 10 * MIN,
      arrivalAt: 18 * MIN,
      extra: { kind: "stops", stops: 3 },
    });
    const arrived = single({ getOff: { ...getOff, arrivedAt: 19 * MIN } });
    expect(travelStats(arrived, undefined, 0, 20 * MIN)).toEqual({
      departureAt: 10 * MIN,
      arrivalAt: 19 * MIN,
      extra: { kind: "duration", ms: 9 * MIN },
    });
  });
});
