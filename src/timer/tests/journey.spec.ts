import { describe, expect, it } from "vitest";
import {
  connectionStatus,
  delayMs,
  expected,
  fallbackPlan,
  feasible,
  formatTime,
  journeyHeadline,
  journeyState,
  laterPlan,
  type Leg,
  transfer,
  transferMessage,
  transferWalkingMs,
} from "../journey";

const MIN = 60_000;

// Lugano, Bellavista → Lugano, Centro: about 330 m apart
const bellavista = { name: "Lugano, Bellavista", position: { lat: 46.00374, lon: 8.94763 } };
const centro = { name: "Lugano, Centro", position: { lat: 46.00495, lon: 8.95153 } };
const cornaredo = { name: "Lugano, Cornaredo" };
const paradiso = { name: "Paradiso, Stazione" };

// A leg ridden from `departure` to `arrival` minutes, with delays in minutes
function leg(
  line: string,
  departure: number,
  arrival: number,
  delay?: { departure?: number; arrival?: number },
  stops: Pick<Leg, "from" | "to"> = { from: cornaredo, to: centro }
): Leg {
  const timing = (minutes: number, late?: number) => ({
    scheduled: minutes * MIN,
    estimated: late === undefined ? undefined : (minutes + late) * MIN,
  });
  return {
    line,
    destination: line === "5" ? "Paradiso" : "Centro",
    ...stops,
    departure: timing(departure, delay?.departure),
    arrival: timing(arrival, delay?.arrival),
  };
}

const toParadiso = (departure: number, arrival: number, late?: number) =>
  leg("5", departure, arrival, late === undefined ? undefined : { departure: late, arrival: late }, {
    from: centro,
    to: paradiso,
  });

describe("timing", () => {
  it("prefers the real-time estimate", () => {
    expect(expected({ scheduled: 1000 })).toBe(1000);
    expect(expected({ scheduled: 1000, estimated: 1500 })).toBe(1500);
  });

  it("measures the delay", () => {
    expect(delayMs({ scheduled: 1000 })).toBe(0);
    expect(delayMs({ scheduled: 1000, estimated: 1500 })).toBe(500);
    expect(delayMs({ scheduled: 1000, estimated: 800 })).toBe(-200);
  });
});

describe("transferWalkingMs", () => {
  it("walks between the platforms", () => {
    const ms = transferWalkingMs(bellavista, centro);
    expect(ms).toBeGreaterThan(5 * MIN);
    expect(ms).toBeLessThan(6 * MIN);
    expect(transferWalkingMs(bellavista, centro, "fast")).toBeLessThan(ms);
  });

  it("assumes no walk without positions", () => {
    expect(transferWalkingMs(cornaredo, centro)).toBe(0);
    expect(transferWalkingMs(centro, centro)).toBe(0);
  });
});

describe("connectionStatus", () => {
  it("grades the slack", () => {
    expect(connectionStatus(5 * MIN)).toBe("ok");
    expect(connectionStatus(2 * MIN)).toBe("ok");
    expect(connectionStatus(90_000)).toBe("tight");
    expect(connectionStatus(0)).toBe("tight");
    expect(connectionStatus(-1)).toBe("missed");
  });

  it("is tight only once delays eat into the planned slack", () => {
    expect(connectionStatus(0, undefined, 0)).toBe("ok");
    expect(connectionStatus(MIN, undefined, MIN)).toBe("ok");
    expect(connectionStatus(30_000, undefined, MIN)).toBe("tight");
    expect(connectionStatus(-1, undefined, 0)).toBe("missed");
  });

  it("tolerates a slack below zero", () => {
    expect(connectionStatus(-MIN, undefined, -MIN, MIN)).toBe("tight");
    expect(connectionStatus(-2 * MIN, undefined, -MIN, MIN)).toBe("missed");
  });
});

describe("transfer", () => {
  it("leaves a minute to change bus", () => {
    const change = transfer(leg("2", 0, 10), toParadiso(15, 25));
    expect(change).toEqual({ at: centro, walkingMs: 0, slackMs: 4 * MIN, status: "ok" });
  });

  it("follows the delay of the arriving bus", () => {
    expect(transfer(leg("2", 0, 10, { arrival: 3 }), toParadiso(15, 25)).status).toBe(
      "tight"
    );
    expect(transfer(leg("2", 0, 10, { arrival: 5 }), toParadiso(15, 25)).status).toBe(
      "missed"
    );
  });

  it("is saved by a delay of the departing bus", () => {
    const change = transfer(leg("2", 0, 10, { arrival: 5 }), toParadiso(15, 25, 4));
    expect(change.slackMs).toBe(3 * MIN);
    expect(change.status).toBe("ok");
  });

  it("includes the walk to another platform", () => {
    const stops = { from: cornaredo, to: bellavista };
    const change = transfer(leg("2", 0, 10, undefined, stops), toParadiso(18, 28));
    expect(change.at).toBe(bellavista);
    expect(change.walkingMs).toBeGreaterThan(5 * MIN);
    expect(change.slackMs).toBeLessThan(2 * MIN);
    // Planned that tight: tight only once late
    expect(change.status).toBe("ok");
    const late = transfer(leg("2", 0, 10, { arrival: 1 }, stops), toParadiso(18, 28));
    expect(late.status).toBe("tight");
  });

  it("prefers the walk planned by the timetable", () => {
    const departing = { ...toParadiso(15, 25), walkBeforeMs: 2 * MIN };
    expect(transfer(leg("2", 0, 10), departing).walkingMs).toBe(2 * MIN);
    expect(transfer(leg("2", 0, 10), departing).status).toBe("ok");
    expect(transfer(leg("2", 0, 10), departing, { pace: "slow" }).walkingMs).toBeCloseTo(
      2.6 * MIN
    );
  });

  // S10 arriving in Lugano, then a 4 min walk to the bus 6, as planned by SBB
  describe("with the walk of the timetable", () => {
    const departing = { ...toParadiso(14, 25), walkBeforeMs: 4 * MIN };

    it("makes an exact connection on schedule", () => {
      const change = transfer(leg("S10", 0, 10), departing);
      expect(change).toEqual({ at: centro, walkingMs: 4 * MIN, slackMs: 0, status: "ok" });
      expect(feasible({ legs: [leg("S10", 0, 10), departing] })).toBe(true);
    });

    it("loses it when the train is late", () => {
      const change = transfer(leg("S10", 0, 10, { arrival: 1 }), departing);
      expect(change.slackMs).toBe(-MIN);
      expect(change.status).toBe("missed");
    });

    it("gets tight when delays eat into the planned slack", () => {
      const roomy = { ...toParadiso(16, 25), walkBeforeMs: 4 * MIN };
      expect(transfer(leg("S10", 0, 10), roomy).status).toBe("ok");
      expect(transfer(leg("S10", 0, 10, { arrival: 1 }), roomy).status).toBe("tight");
      expect(transfer(leg("S10", 0, 10, { arrival: 3 }), roomy).status).toBe("missed");
    });

    it("follows the pace of the user", () => {
      const slow = transfer(leg("S10", 0, 10), departing, { pace: "slow" });
      expect(slow.slackMs).toBeCloseTo(-1.2 * MIN);
      expect(slow.status).toBe("tight");
      const slowLate = transfer(leg("S10", 0, 10, { arrival: 1 }), departing, {
        pace: "slow",
      });
      expect(slowLate.status).toBe("missed");
      const fast = transfer(leg("S10", 0, 10, { arrival: 0.5 }), departing, {
        pace: "fast",
      });
      expect(fast.status).toBe("tight");
    });
  });

  it("takes custom margins", () => {
    const change = transfer(leg("2", 0, 10, { arrival: 1 }), toParadiso(15, 25), {
      minimumMs: 0,
      tightMs: 6 * MIN,
    });
    expect(change.slackMs).toBe(4 * MIN);
    expect(change.status).toBe("tight");
  });
});

describe("journeyState", () => {
  it("counts down to the first bus", () => {
    const state = journeyState([leg("2", 10, 20)], 0, 120);
    expect(state.start).toEqual({
      departureMs: 10 * MIN,
      leaveMs: 8 * MIN,
      walkingMs: 2 * MIN,
    });
    expect(state.transfers).toEqual([]);
    expect(state.status).toBe("ok");
    expect(state.arrivalAt).toBe(20 * MIN);
  });

  it("reports the worst transfer and the expected arrival", () => {
    const state = journeyState(
      [
        leg("2", 10, 20, { departure: 2, arrival: 4 }),
        toParadiso(25, 30),
        leg("1", 33, 40, undefined, { from: paradiso, to: centro }),
      ],
      0,
      undefined
    );
    expect(state.start.departureMs).toBe(12 * MIN);
    expect(state.transfers.map(({ status }) => status)).toEqual(["tight", "ok"]);
    expect(state.status).toBe("tight");
    expect(state.arrivalAt).toBe(40 * MIN);
  });

  it("needs a leg", () => {
    expect(() => journeyState([], 0, undefined)).toThrow();
  });
});

describe("plans", () => {
  // Bus 2 to Centro, then bus 5 to Paradiso
  const plan = (first: Leg, second: Leg) => ({ legs: [first, second] });

  it("checks that every transfer can be made", () => {
    expect(feasible(plan(leg("2", 0, 10), toParadiso(15, 25)))).toBe(true);
    expect(feasible(plan(leg("2", 0, 10, { arrival: 5 }), toParadiso(15, 25)))).toBe(false);
    expect(feasible({ legs: [leg("2", 0, 10)] })).toBe(true);
  });

  it("falls back on the first plan that can be caught", () => {
    // Bus 1 to Centro, late: the bus 2 at 12 is lost
    const arriving = (late: number) =>
      leg("1", 0, 10, { arrival: late }, { from: paradiso, to: centro });
    const lost = leg("2", 12, 22, undefined, { from: centro, to: cornaredo });
    const plans = [
      plan(leg("2", 5, 15, undefined, { from: centro, to: cornaredo }), toParadiso(20, 30)),
      plan(lost, toParadiso(30, 40)),
      plan(leg("2", 14, 24, { arrival: 8 }), toParadiso(30, 38)),
      plan(leg("2", 20, 30, undefined, { from: centro, to: cornaredo }), toParadiso(40, 50)),
    ];
    expect(fallbackPlan(plans, arriving(5), lost)).toBe(plans[3]);
    expect(fallbackPlan(plans, arriving(20), lost)).toBeUndefined();
  });

  it("never falls back on the bus just lost", () => {
    // S10 in Lugano 10 min late: the bus 6 at 14, 4 min away, is lost even
    // when the plans of the timetable still show it on time
    const train = leg("S10", 0, 10, { arrival: 10 });
    const bus = (departure: number) => ({ ...toParadiso(departure, departure + 10), walkBeforeMs: 4 * MIN });
    const lost = bus(14);
    expect(transfer(train, lost).status).toBe("missed");
    const plans = [{ legs: [lost] }, { legs: [bus(22)] }, { legs: [bus(26)] }];
    expect(fallbackPlan(plans, train, lost)).toBe(plans[2]);
    // Late too: still the bus just lost
    const lateLost = { ...lost, departure: { scheduled: 14 * MIN, estimated: 25 * MIN } };
    expect(fallbackPlan([{ legs: [lateLost] }], train, lost)).toBeUndefined();
  });

  it("suggests leaving later when the arrival does not change", () => {
    const current = plan(leg("2", 5, 15), toParadiso(30, 40));
    const plans = [
      current,
      plan(leg("2", 12, 22), toParadiso(30, 40)),
      plan(leg("2", 20, 30), toParadiso(30, 40)),
      plan(leg("2", 22, 32), toParadiso(45, 55)),
    ];
    expect(laterPlan(plans, current)).toBe(plans[1]);
    // The bus 5 is late: the next bus 2 still makes it
    const delayed = plans.slice(0, 3).map((p) => plan(p.legs[0], toParadiso(30, 40, 3)));
    expect(laterPlan(delayed, plan(current.legs[0], toParadiso(30, 40, 3)))).toBe(
      delayed[2]
    );
    expect(laterPlan([current], current)).toBeUndefined();
  });
});

describe("transferMessage", () => {
  const arriving = (late: number) => leg("2", 0, 10, { arrival: late });
  const departing = toParadiso(15, 25);

  it("says nothing while the connection is fine", () => {
    expect(transferMessage(departing, transfer(arriving(0), departing))).toBeUndefined();
  });

  it("warns about a tight connection", () => {
    expect(transferMessage(departing, transfer(arriving(3), departing))).toEqual({
      title: "Coincidenza stretta a Lugano, Centro",
      body: "Linea 5 per Paradiso · 1 min di margine",
    });
    expect(transferMessage(departing, transfer(arriving(4), departing))?.body).toBe(
      "Linea 5 per Paradiso · nessun margine, affrettati"
    );
  });

  it("tells by how much a connection is missed", () => {
    expect(transferMessage(departing, transfer(arriving(7), departing))).toEqual({
      title: "Coincidenza a rischio a Lugano, Centro",
      body: "Linea 5 per Paradiso · in ritardo di 3 min",
    });
  });

  it("suggests the next bus", () => {
    const alternative = { leg: toParadiso(25, 35), laterMs: 10 * MIN };
    expect(
      transferMessage(departing, transfer(arriving(7), departing), alternative)
    ).toEqual({
      title: "Coincidenza a rischio a Lugano, Centro",
      body: `Prossima linea 5 alle ${formatTime(25 * MIN)}, arrivo +10 min`,
    });
  });

  it("formats times in Lugano", () => {
    // 2026-10-11 06:14 UTC is 08:14 in summer time
    expect(formatTime(Date.UTC(2026, 9, 11, 6, 14))).toBe("08:14");
  });
});

describe("journeyHeadline", () => {
  const legs = [leg("2", 0, 10), toParadiso(15, 25)];

  it("leaves the countdown to the timer before the first bus", () => {
    expect(journeyHeadline(legs, -MIN)).toBeUndefined();
  });

  it("tells when to get off, wait and arrive", () => {
    expect(journeyHeadline(legs, 4 * MIN)).toEqual({
      label: "Scendi a Lugano, Centro tra",
      ms: 6 * MIN,
      phase: "transfer",
    });
    expect(journeyHeadline(legs, 12 * MIN)).toEqual({
      label: "Linea 5 tra",
      ms: 3 * MIN,
      phase: "bus",
    });
    expect(journeyHeadline(legs, 20 * MIN)).toEqual({
      label: "Arrivo tra",
      ms: 5 * MIN,
      phase: "arrival",
    });
    expect(journeyHeadline(legs, 30 * MIN)).toEqual({ label: "Arrivato", ms: 0, phase: "arrival" });
  });
});
