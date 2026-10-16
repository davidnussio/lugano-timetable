import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  lineLabel,
  opendataDateTime,
  parseTime,
  toConnection,
  toLegUpdate,
  toStation,
  toStationDeparture,
} from "../convert";
import {
  ConnectionsResponse,
  LocationsResponse,
  StationboardResponse,
} from "../schema";
import { centroBoard, connection, locations, stationboard } from "./fixtures";

const decode = <S extends Schema.Top>(schema: S, value: unknown): S["Type"] =>
  Schema.decodeUnknownSync(schema as never)(value) as S["Type"];

// 2026-10-11 hh:mm in Lugano (summer time)
const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 9, 11, hours - 2, minutes);

describe("parseTime", () => {
  it("parses offsets without a colon", () => {
    expect(parseTime("2026-10-11T19:10:00+0200")).toBe(at(19, 10));
    expect(parseTime("2026-10-11T19:10:00+02:00")).toBe(at(19, 10));
  });

  it("ignores missing values", () => {
    expect(parseTime(null)).toBeUndefined();
    expect(parseTime("")).toBeUndefined();
    expect(parseTime("soon")).toBeUndefined();
  });
});

describe("opendataDateTime", () => {
  it("formats the local time of Lugano", () => {
    expect(opendataDateTime(at(19, 6))).toBe("2026-10-11 19:06");
    expect(opendataDateTime(Date.UTC(2026, 0, 5, 23, 30))).toBe("2026-01-06 00:30");
  });
});

describe("lineLabel", () => {
  it("names buses by number and trains by category", () => {
    expect(lineLabel("B", "4")).toBe("4");
    expect(lineLabel("B", "461")).toBe("461");
    expect(lineLabel("S", "10")).toBe("S10");
    expect(lineLabel("RE", "80")).toBe("RE80");
    expect(lineLabel("EC", "000306")).toBe("EC");
    expect(lineLabel("IC", null)).toBe("IC");
  });
});

describe("toStation", () => {
  it("keeps the stops with a code", () => {
    const { stations } = decode(LocationsResponse, locations);
    expect(stations.map(toStation)).toEqual([
      undefined,
      {
        id: "8591603",
        name: "Lugano, Centro",
        position: { lat: 46.005983, lon: 8.952448 },
        distance: 141,
        icon: "bus",
      },
      {
        id: "8505550",
        name: "Lugano Centrale (lago)",
        position: { lat: 46.002969, lon: 8.951559 },
        distance: 215,
        icon: "ship",
      },
    ]);
  });
});

describe("toConnection", () => {
  const { connections } = decode(ConnectionsResponse, { connections: [connection] });
  const result = toConnection(connections[0]);

  it("keeps the rides with their forecasts", () => {
    expect(result?.legs.map((leg) => leg.line)).toEqual(["461", "EC"]);
    const [bus, train] = result?.legs ?? [];
    expect(bus).toMatchObject({
      trip: "000756",
      category: "B",
      operator: "ARL",
      destination: "Lugano, Ospedale Civico",
      from: { id: "8505561", name: "Viganello, S. Siro" },
      to: { id: "8591805", name: "Lugano, Stazione Nord" },
      departure: { scheduled: at(19, 34), estimated: at(19, 34) },
      arrival: { scheduled: at(19, 50), estimated: at(19, 50) },
    });
    expect(train).toMatchObject({
      departure: { scheduled: at(19, 30), estimated: at(20, 1) },
      arrival: { scheduled: at(19, 46), estimated: at(20, 13) },
    });
  });

  it("moves the walks onto the following leg", () => {
    expect(result?.legs.map((leg) => leg.walkBeforeMs)).toEqual([360_000, 300_000]);
    expect(result?.walkAfterMs).toBeUndefined();
  });

  it("keeps the walk to the destination", () => {
    const sections = [...connection.sections];
    const walkToEnd = { ...sections[2], arrival: sections[3].arrival };
    const { connections } = decode(ConnectionsResponse, {
      connections: [{ sections: [sections[1], walkToEnd] }],
    });
    expect(toConnection(connections[0])?.walkAfterMs).toBe(300_000);
  });

  it("drops connections without rides", () => {
    const { connections } = decode(ConnectionsResponse, {
      connections: [{ sections: [connection.sections[0]] }],
    });
    expect(toConnection(connections[0])).toBeUndefined();
  });
});

describe("toLegUpdate", () => {
  const entries = decode(StationboardResponse, stationboard).stationboard;

  it("finds the trip and its arrival", () => {
    expect(toLegUpdate(entries, "003376", "8575286")).toEqual({
      departure: { scheduled: at(20, 19), estimated: at(20, 21) },
      arrival: { scheduled: at(20, 30), estimated: at(20, 32) },
    });
  });

  it("returns null when the trip or the stop is missing", () => {
    expect(toLegUpdate(entries, "009999", "8575286")).toBeNull();
    expect(toLegUpdate(entries, "005250", "8575286")).toBeNull();
  });
});

describe("toStationDeparture", () => {
  const entries = decode(StationboardResponse, centroBoard).stationboard;
  const departures = entries.map(toStationDeparture);

  it("keeps line, operator and forecast", () => {
    expect(departures[0]).toEqual({
      trip: "002118",
      line: "2",
      category: "B",
      operator: "TPL",
      destination: "Paradiso, Geretta",
      departure: { scheduled: at(20, 5), estimated: at(20, 8) },
      platform: "B",
    });
    expect(departures[1]).toMatchObject({ line: "442", operator: "ARL" });
  });

  it("names the destination after the last stop when missing", () => {
    expect(departures[2]).toMatchObject({
      destination: "Manno, Uovo di Manno",
      departure: { scheduled: at(20, 9) },
    });
    expect(departures[2]?.departure.estimated).toBeUndefined();
    expect(departures[2]?.platform).toBeUndefined();
  });

  it("prefers the platform of the forecast", () => {
    expect(departures[3]?.platform).toBe("A");
  });

  it("drops the runs without a scheduled time", () => {
    expect(departures[4]).toBeUndefined();
  });
});
