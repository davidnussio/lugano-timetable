import { describe, expect, it } from "vitest";
import {
  connectionStatus,
  delayMs,
  earliestConnecting,
  expected,
  formatTime,
  journeyState,
  latestConnecting,
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
    const arriving = leg("2", 0, 10, undefined, { from: cornaredo, to: bellavista });
    const change = transfer(arriving, toParadiso(18, 28));
    expect(change.at).toBe(bellavista);
    expect(change.walkingMs).toBeGreaterThan(5 * MIN);
    expect(change.status).toBe("tight");
  });

  it("takes custom margins", () => {
    const change = transfer(leg("2", 0, 10), toParadiso(15, 25), {
      minimumMs: 0,
      tightMs: 6 * MIN,
    });
    expect(change.slackMs).toBe(5 * MIN);
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

describe("latestConnecting", () => {
  const departing = toParadiso(30, 40);

  it("catches the latest bus that is still in time", () => {
    const candidates = [leg("2", 5, 15), leg("2", 12, 22), leg("2", 20, 30)];
    expect(latestConnecting(candidates, departing)).toBe(candidates[1]);
  });

  it("follows the delays of both buses", () => {
    const candidates = [leg("2", 5, 15), leg("2", 12, 22, { arrival: 8 })];
    expect(latestConnecting(candidates, departing)).toBe(candidates[0]);
    expect(latestConnecting(candidates, toParadiso(30, 40, 3))).toBe(candidates[1]);
  });

  it("finds nothing when every bus is too late", () => {
    expect(latestConnecting([leg("2", 25, 35)], departing)).toBeUndefined();
  });
});

describe("earliestConnecting", () => {
  it("falls back on the next bus that can be caught", () => {
    const arriving = leg("2", 0, 10, { arrival: 6 });
    const candidates = [toParadiso(30, 40), toParadiso(15, 25), toParadiso(22, 32)];
    expect(earliestConnecting(arriving, candidates)).toBe(candidates[2]);
    expect(earliestConnecting(leg("2", 0, 40), candidates)).toBeUndefined();
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
    const next = toParadiso(25, 35);
    expect(
      transferMessage(departing, transfer(arriving(7), departing), next)
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
