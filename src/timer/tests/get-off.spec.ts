import { describe, expect, it } from "vitest";
import { messages } from "~/i18n/messages";
import { RoutingStatus } from "~/timetable/models";
import {
  clockAt,
  dueGetOffAlert,
  followRide,
  type GetOff,
  getOffHeadline,
  getOffMessage,
  type Ride,
  rideState,
  rideSummary,
} from "../get-off";

// The Italian texts: the words asserted below
const m = messages.it;

const MIN = 60_000;
const { FeatureStation: F, CurrentStation: C, PassedStation: P, Origin: O } =
  RoutingStatus;

// Stops "0" to "5": the user boards at "1" and gets off at "4"
const route = (...statuses: RoutingStatus[]) =>
  statuses.map((Status, index) => ({
    UID: String(index),
    Time: `08:1${index}`,
    Status,
  }));

const getOff: GetOff = { target: "4", name: "Cornaredo", alerted: [] };

// 08:00 in Lugano (summer time)
const eight = Date.UTC(2026, 9, 16, 6, 0, 0);

describe("rideState", () => {
  it("waits for the bus at the stop of the user", () => {
    expect(rideState(route(O, C, F, F, F, F), "1", getOff)).toEqual({
      left: false,
      stopsLeft: 3,
      status: "before",
      time: "08:14",
    });
  });

  it("counts the stops left once on board", () => {
    expect(rideState(route(O, P, F, F, F, F), "1", getOff)).toMatchObject({
      left: true,
      stopsLeft: 3,
      status: "before",
    });
    expect(rideState(route(O, P, P, C, F, F), "1", getOff)).toMatchObject({
      stopsLeft: 1,
      status: "before",
    });
  });

  it("tells when the stop is next, then reached, then passed", () => {
    expect(rideState(route(O, P, P, P, F, F), "1", getOff)).toMatchObject({
      stopsLeft: 1,
      status: "next",
    });
    expect(rideState(route(O, P, P, P, C, F), "1", getOff)).toMatchObject({
      stopsLeft: 0,
      status: "at",
    });
    expect(rideState(route(O, P, P, P, P, F), "1", getOff)?.status).toBe("passed");
    expect(rideState(route(O, P, P, P, P, P), "1", getOff)?.status).toBe("passed");
  });

  it("gets off at the stop right after the user's", () => {
    const next = { ...getOff, target: "2" };
    expect(rideState(route(O, C, F, F, F, F), "1", next)?.status).toBe("before");
    expect(rideState(route(O, P, F, F, F, F), "1", next)?.status).toBe("next");
  });

  it("ignores a routing without the stops, or with the stop before the user's", () => {
    expect(rideState([], "1", getOff)).toBeUndefined();
    expect(rideState(route(O, P, F, F, F, F), "9", getOff)).toBeUndefined();
    expect(rideState(route(O, P, F, F, F, F), "4", { ...getOff, target: "1" })).toBeUndefined();
  });

  it("does not take the next run for the bus once left", () => {
    const left = { ...getOff, left: true };
    expect(rideState(route(O, C, F, F, F, F), "1", left)).toBeUndefined();
    expect(rideState(route(O, P, P, F, F, F), "1", left)?.left).toBe(true);
  });
});

describe("clockAt", () => {
  it("reads the time in Lugano", () => {
    expect(clockAt("08:14", eight)).toBe(eight + 14 * MIN);
    expect(clockAt("7:50", eight)).toBe(eight - 10 * MIN);
    // Winter time
    const winter = Date.UTC(2026, 11, 1, 7, 0, 0);
    expect(clockAt("08:30", winter)).toBe(winter + 30 * MIN);
  });

  it("is at the start of the minute", () => {
    expect(clockAt("08:14", eight + 25_400)).toBe(eight + 14 * MIN);
  });

  it("crosses midnight both ways", () => {
    const late = Date.UTC(2026, 9, 16, 21, 55, 0); // 23:55
    expect(clockAt("00:05", late)).toBe(late + 10 * MIN);
    const early = Date.UTC(2026, 9, 16, 22, 2, 0); // 00:02
    expect(clockAt("23:58", early)).toBe(early - 4 * MIN);
  });

  it("rejects anything else", () => {
    expect(clockAt("", eight)).toBeUndefined();
    expect(clockAt("8.14", eight)).toBeUndefined();
  });
});

const ride = (status: Ride["status"], stopsLeft = 1, left = true): Ride => ({
  left,
  stopsLeft,
  status,
  time: "08:14",
});

describe("followRide", () => {
  it("records the bus leaving and the latest time at the stop", () => {
    const next = followRide(getOff, ride("before", 3), eight);
    expect(next).toEqual({ ...getOff, left: true, arrivalAt: eight + 14 * MIN });
    expect(followRide(next, ride("before", 2), eight + 30_000)).toBe(next);
  });

  it("records the arrival once, then keeps the time", () => {
    const riding = { ...getOff, left: true, arrivalAt: eight + 14 * MIN };
    const arrived = followRide(riding, ride("at", 0), eight + 15 * MIN);
    expect(arrived.arrivedAt).toBe(eight + 15 * MIN);
    expect(followRide(arrived, { ...ride("passed", 0), time: "08:16" }, eight + 16 * MIN)).toBe(
      arrived
    );
  });

  it("keeps everything without the routing", () => {
    expect(followRide(getOff, undefined, eight)).toBe(getOff);
  });
});

describe("dueGetOffAlert", () => {
  it("tells to get ready when the stop is next, then to get off", () => {
    expect(dueGetOffAlert(ride("before", 2), undefined, [], true)).toBeUndefined();
    expect(dueGetOffAlert(ride("next"), undefined, [], true)).toBe("next");
    expect(dueGetOffAlert(ride("next"), undefined, ["next"], true)).toBeUndefined();
    expect(dueGetOffAlert(ride("at", 0), undefined, ["next"], true)).toBe("now");
    expect(dueGetOffAlert(ride("at", 0), undefined, ["next", "now"], true)).toBeUndefined();
  });

  it("tells to get off also when the next stop was missed", () => {
    expect(dueGetOffAlert(ride("at", 0), undefined, [], true)).toBe("now");
  });

  it("says nothing once past the stop", () => {
    expect(dueGetOffAlert(ride("passed", 0), undefined, ["next"], true)).toBeUndefined();
  });

  it("trusts the routing over the GPS", () => {
    expect(dueGetOffAlert(ride("before", 2), 100, [], true)).toBeUndefined();
  });

  it("falls back on the GPS once the bus has left", () => {
    expect(dueGetOffAlert(undefined, 250, [], true)).toBe("now");
    expect(dueGetOffAlert(undefined, 450, [], true)).toBeUndefined();
    expect(dueGetOffAlert(undefined, undefined, [], true)).toBeUndefined();
    expect(dueGetOffAlert(undefined, 250, [], false)).toBeUndefined();
    expect(dueGetOffAlert(undefined, 250, ["now"], true)).toBeUndefined();
  });
});

describe("getOffMessage", () => {
  it("names the stop and the bus", () => {
    expect(getOffMessage(m, "next", getOff, "5", "Cornaredo")).toEqual({
      title: "Prossima fermata: Cornaredo",
      body: "Preparati a scendere · Linea 5 per Cornaredo",
    });
    expect(getOffMessage(m, "now", getOff, "5", "Cornaredo")).toEqual({
      title: "Scendi ora a Cornaredo",
      body: "Linea 5 per Cornaredo",
    });
  });
});

describe("getOffHeadline", () => {
  const timed = { ...getOff, arrivalAt: eight + 14 * MIN };

  it("leaves the countdown to the bus until it has left", () => {
    expect(getOffHeadline(m, timed, ride("before", 3, false), true, eight)).toBeUndefined();
    expect(getOffHeadline(m, timed, undefined, false, eight)).toBeUndefined();
  });

  it("counts down to the stop", () => {
    expect(getOffHeadline(m, timed, ride("before", 3), false, eight)).toEqual({
      label: "Scendi a Cornaredo tra",
      ms: 14 * MIN,
      phase: "arrival",
    });
    // Without the routing, from the departure
    expect(getOffHeadline(m, timed, undefined, true, eight)?.ms).toBe(14 * MIN);
    expect(getOffHeadline(m, timed, ride("next"), false, eight + 15 * MIN)?.label).toBe(
      "In arrivo a Cornaredo"
    );
  });

  it("tells to get off, then the arrival", () => {
    expect(getOffHeadline(m, timed, ride("at", 0), false, eight)?.label).toBe(
      "Scendi ora a Cornaredo"
    );
    expect(
      getOffHeadline(m, { ...timed, alerted: ["now"] }, undefined, true, eight)?.label
    ).toBe("Scendi ora a Cornaredo");
    expect(
      getOffHeadline(m, { ...timed, arrivedAt: eight }, undefined, true, eight)
    ).toEqual({ label: "Arrivato a Cornaredo", ms: 0, phase: "arrival" });
  });
});

describe("rideSummary", () => {
  it("tells the stops left", () => {
    expect(rideSummary(m.ride, getOff, ride("before", 3))).toBe("Ancora 3 fermate");
    expect(rideSummary(m.ride, getOff, ride("before", 1))).toBe("Prossima fermata");
    expect(rideSummary(m.ride, getOff, ride("next"))).toBe("Prossima fermata");
    expect(rideSummary(m.ride, getOff, ride("at", 0))).toBe("Il bus è alla fermata");
    expect(rideSummary(m.ride, getOff, ride("passed", 0))).toBe("Il bus ha lasciato la fermata");
    expect(rideSummary(m.ride, getOff, undefined)).toBe("In viaggio verso Cornaredo");
  });
});
