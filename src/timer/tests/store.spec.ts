import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import { InTimeStatus, type Departure, type Target } from "~/timetable/models";
import { transfer } from "../journey";
import {
  type ActiveTimer,
  applyLegUpdates,
  createJourneyTimer,
  dueTransferAlert,
  findTimerDeparture,
  legsQuery,
  liveLegs,
  planAlerts,
  timerEndsAt,
} from "../store";

const MIN = 60_000;

const station = (id: string, name: string, lat = 46, lon = 8.95): Station => ({
  id,
  name,
  position: { lat, lon },
});
const centro = station("8591603", "Lugano, Centro", 46.00495, 8.95153);
const besso = station("8575286", "Lugano, Stazione Piazza Besso");
const lugano = station("8505300", "Lugano");
const bellinzona = station("8505213", "Bellinzona");

const leg = (
  line: string,
  from: Station,
  to: Station,
  departure: number,
  arrival: number,
  operator = "TPL"
): PlannedLeg => ({
  trip: `00${line}000`,
  category: operator === "TPL" ? "B" : "S",
  line,
  operator,
  destination: to.name,
  from,
  to,
  departure: { scheduled: departure * MIN },
  arrival: { scheduled: arrival * MIN },
});

const connection: Connection = {
  legs: [
    leg("3", centro, besso, 10, 20),
    { ...leg("S10", lugano, bellinzona, 30, 48, "SBB"), walkBeforeMs: 4 * MIN },
  ],
  walkAfterMs: 2 * MIN,
};

const targets: ReadonlyArray<Target> = [
  {
    Name: "Centro",
    Label: "Lugano, Centro",
    Identifiers: ["12", "13"],
    Coordinates: [
      { Id: "12", Lat: 46.00598, Lon: 8.95245 },
      { Id: "13", Lat: 46.00495, Lon: 8.95153 },
    ],
    CodeNat: "8591603",
  },
];

const departure = (RouteCode: string, minutes: number, Uid: number): Departure => ({
  Target: "13",
  Route: "21",
  RouteCode,
  Dir: "2",
  Routing: "700",
  Dest: "Breganzona",
  Img: "21.jpg",
  Time: "08:00",
  Pred: InTimeStatus.OnTime,
  Wait: 0,
  Uid,
  DepartureAt: minutes * MIN,
});

const timer = (patch: Partial<ActiveTimer> = {}): ActiveTimer => ({
  ...createJourneyTimer(connection, centro, bellinzona, targets, 0),
  ...patch,
});

describe("createJourneyTimer", () => {
  it("counts down to the first leg at its TPL stop", () => {
    const created = timer();
    expect(created).toMatchObject({
      stop: { name: "Centro", label: "Lugano, Centro", identifiers: ["12", "13"] },
      coordinates: { lat: 46.00495, lon: 8.95153 },
      line: "3",
      destination: "Lugano, Stazione Piazza Besso",
      target: "",
      routing: "",
      departureAt: 10 * MIN,
      journey: { from: centro, to: bellinzona, walkAfterMs: 2 * MIN, alerted: [] },
    });
    expect(created.journey?.legs).toBe(connection.legs);
  });

  it("follows other operators with the timetable only", () => {
    const train: Connection = { legs: [connection.legs[1]] };
    expect(createJourneyTimer(train, lugano, bellinzona, targets, 0)).toMatchObject({
      stop: { name: "Lugano", label: "Lugano", identifiers: [] },
      coordinates: lugano.position,
      line: "S10",
    });
  });
});

describe("findTimerDeparture", () => {
  it("finds a planned bus by line and time", () => {
    const departures = [departure("3", 4, 1), departure("3", 11, 2), departure("5", 10, 3)];
    expect(findTimerDeparture(timer(), departures, false)?.Uid).toBe(2);
  });

  it("then follows it by trip id", () => {
    const departures = [departure("3", 4, 1), departure("3", 11, 2)];
    expect(findTimerDeparture(timer({ uid: 1, routing: "700" }), departures, false)?.Uid).toBe(1);
  });
});

describe("findTimerDeparture of a followed bus", () => {
  const followed = (patch: Partial<ActiveTimer> = {}) =>
    timer({ target: "13", routing: "700", departureAt: 10 * MIN, ...patch });

  it("only takes the same trip once known", () => {
    const next = departure("3", 20, 2);
    expect(findTimerDeparture(followed({ uid: 1 }), [next], false)).toBeUndefined();
    expect(findTimerDeparture(followed({ uid: 1 }), [{ ...next, Uid: undefined }], false)).toBeUndefined();
  });

  it("takes the closest run of the line without trip id", () => {
    const departures = [departure("3", 4, 1), departure("3", 12, 2)];
    expect(findTimerDeparture(followed(), departures, false)?.Uid).toBe(2);
  });

  it("does not jump to another run", () => {
    expect(findTimerDeparture(followed(), [departure("3", 25, 2)], false)).toBeUndefined();
  });

  it("does not move a departed bus later", () => {
    const later = [departure("3", 13, 2)];
    expect(findTimerDeparture(followed(), later, false)?.Uid).toBe(2);
    expect(findTimerDeparture(followed(), later, true)).toBeUndefined();
    expect(findTimerDeparture(followed(), [departure("3", 10, 1)], true)?.Uid).toBe(1);
  });
});

describe("planAlerts", () => {
  const planned = timer({ thresholds: [6, 4, 2, 1, 0] });

  it("keeps the thresholds without a walk", () => {
    expect(planAlerts(planned, undefined, 5 * MIN)).toBe(planned);
  });

  it("plans on the walk of the timetable, then on the GPS", () => {
    const timetable = planAlerts(planned, "timetable", 20 * MIN);
    expect(timetable).toMatchObject({
      thresholds: [12, 7, 4, 3, 2, 1, 0],
      plannedWithWalk: true,
      plannedWithGps: false,
    });
    expect(planAlerts(timetable, "timetable", 10 * MIN)).toBe(timetable);
    const gps = planAlerts(timetable, "gps", 10 * MIN);
    expect(gps).toMatchObject({ thresholds: [6, 4, 2, 1, 0], plannedWithGps: true });
    expect(planAlerts(gps, "gps", 30 * MIN)).toBe(gps);
    expect(planAlerts(gps, "timetable", 30 * MIN)).toBe(gps);
  });

  it("keeps the thresholds once an alert was shown", () => {
    const fired = { ...planned, fired: [6] };
    expect(planAlerts(fired, "gps", 20 * MIN)).toBe(fired);
  });
});

describe("legsQuery", () => {
  it("identifies every leg", () => {
    expect(legsQuery(connection.legs)).toBe(
      "leg=8591603%2C003000%2C600000%2C8575286&leg=8505300%2C00S10000%2C1800000%2C8505213"
    );
  });
});

describe("applyLegUpdates", () => {
  const legs = connection.legs;

  it("keeps the same legs when nothing changed", () => {
    expect(applyLegUpdates(legs, [null, null])).toBe(legs);
    expect(
      applyLegUpdates(legs, [
        { departure: legs[0].departure, arrival: legs[0].arrival },
        null,
      ])
    ).toBe(legs);
  });

  it("updates the timings of the legs found", () => {
    const update = {
      departure: { scheduled: 30 * MIN, estimated: 33 * MIN },
      arrival: { scheduled: 48 * MIN, estimated: 50 * MIN },
    };
    const next = applyLegUpdates(legs, [null, update]);
    expect(next[0]).toBe(legs[0]);
    expect(next[1]).toMatchObject({ ...update, line: "S10", walkBeforeMs: 4 * MIN });
  });
});

describe("liveLegs", () => {
  it("uses the timetable until the bus is found", () => {
    expect(liveLegs(timer({ departureAt: 12 * MIN }), 0)).toBe(connection.legs);
  });

  it("moves the first leg with the real-time departure", () => {
    const legs = liveLegs(timer({ departureAt: 12 * MIN, uid: 2 }), 0);
    expect(legs?.[0].departure).toEqual({ scheduled: 10 * MIN, estimated: 12 * MIN });
    expect(legs?.[0].arrival).toEqual({ scheduled: 20 * MIN, estimated: 22 * MIN });
    expect(legs?.[1]).toBe(connection.legs[1]);
  });

  it("trusts the timetable once the bus has left", () => {
    expect(liveLegs(timer({ departureAt: 12 * MIN, uid: 2 }), 13 * MIN)).toBe(
      connection.legs
    );
  });

  it("is undefined without a journey", () => {
    expect(liveLegs(timer({ journey: undefined }), 0)).toBeUndefined();
  });
});

describe("timerEndsAt", () => {
  it("ends at the arrival of a journey", () => {
    expect(timerEndsAt(timer())).toBe(50 * MIN);
    expect(timerEndsAt(timer({ journey: undefined }))).toBe(10 * MIN);
  });
});

describe("dueTransferAlert", () => {
  const legs = connection.legs;
  const late = (minutes: number) => [
    { ...legs[0], arrival: { scheduled: 20 * MIN, estimated: (20 + minutes) * MIN } },
    legs[1],
  ];
  const transfers = (minutes: number) => [transfer(late(minutes)[0], legs[1])];

  it("says nothing while the connection is fine", () => {
    expect(dueTransferAlert(transfers(0), late(0), [], 0)).toBeUndefined();
  });

  it("alerts once per status", () => {
    expect(dueTransferAlert(transfers(5), late(5), [], 0)).toEqual({
      index: 0,
      status: "tight",
      key: "0:tight",
    });
    expect(dueTransferAlert(transfers(5), late(5), ["0:tight"], 0)).toBeUndefined();
    expect(dueTransferAlert(transfers(8), late(8), ["0:tight"], 0)?.key).toBe("0:missed");
  });

  it("stops once the bus has arrived", () => {
    expect(dueTransferAlert(transfers(8), late(8), [], 29 * MIN)).toBeUndefined();
  });
});
