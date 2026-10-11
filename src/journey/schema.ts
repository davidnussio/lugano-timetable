import { Schema } from "effect";

// Responses of transport.opendata.ch (the Swiss public transport timetable,
// with real-time forecasts). Only the fields used by the app are declared;
// most of them are null when unknown.

const Nullable = <S extends Schema.Top>(schema: S) =>
  Schema.optionalKey(Schema.NullOr(schema));

export const OpendataStation = Schema.Struct({
  // National stop code (DIDOK), the `CodeNat` of the TPL platforms. Null for
  // addresses and points of interest.
  id: Nullable(Schema.String),
  name: Nullable(Schema.String),
  // `x` is the latitude and `y` the longitude
  coordinate: Nullable(
    Schema.Struct({ x: Nullable(Schema.Number), y: Nullable(Schema.Number) })
  ),
  // Meters from the searched position
  distance: Nullable(Schema.Number),
  icon: Nullable(Schema.String),
});
export type OpendataStation = typeof OpendataStation.Type;

export const Prognosis = Schema.Struct({
  arrival: Nullable(Schema.String),
  departure: Nullable(Schema.String),
});

export const Checkpoint = Schema.Struct({
  station: OpendataStation,
  // Scheduled times in epoch seconds
  arrivalTimestamp: Nullable(Schema.Number),
  departureTimestamp: Nullable(Schema.Number),
  // Real-time forecasts: present (even when on time) when known
  prognosis: Nullable(Prognosis),
});
export type Checkpoint = typeof Checkpoint.Type;

export const Journey = Schema.Struct({
  // Trip number, stable for the whole day ("004220")
  name: Schema.String,
  // "B" (bus), "S", "RE", "IR", "EC"…
  category: Schema.String,
  number: Nullable(Schema.String),
  operator: Nullable(Schema.String),
  to: Nullable(Schema.String),
  passList: Schema.Array(Checkpoint),
});
export type Journey = typeof Journey.Type;

export const Section = Schema.Struct({
  journey: Nullable(Journey),
  // Walks between stops, in seconds
  walk: Nullable(Schema.Struct({ duration: Nullable(Schema.Number) })),
  departure: Checkpoint,
  arrival: Checkpoint,
});
export type Section = typeof Section.Type;

export const OpendataConnection = Schema.Struct({
  sections: Schema.Array(Section),
});
export type OpendataConnection = typeof OpendataConnection.Type;

export const LocationsResponse = Schema.Struct({
  stations: Schema.Array(OpendataStation),
});

export const ConnectionsResponse = Schema.Struct({
  connections: Schema.Array(OpendataConnection),
});

export const StationboardEntry = Schema.Struct({
  ...Journey.fields,
  stop: Checkpoint,
});
export type StationboardEntry = typeof StationboardEntry.Type;

export const StationboardResponse = Schema.Struct({
  stationboard: Schema.Array(StationboardEntry),
});

// National stop codes coming from query strings
export const StationId = Schema.String.check(Schema.isPattern(/^\d{7}$/));
