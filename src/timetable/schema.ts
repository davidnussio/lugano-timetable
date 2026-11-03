import { Schema } from "effect";
import { InTimeStatus, RoutingStatus } from "./models";

// Only the fields used by the app are declared: everything else returned by
// the RTPI server is dropped while decoding.

export const Coordinates = Schema.Struct({
  Id: Schema.String,
  Lat: Schema.Number,
  Lon: Schema.Number,
});
export type Coordinates = typeof Coordinates.Type;

export const Target = Schema.Struct({
  Name: Schema.String,
  Label: Schema.String,
  Identifiers: Schema.Array(Schema.String),
  // Position of every platform of the stop that has one
  Coordinates: Schema.Array(Coordinates),
  // National stop code shared by the platforms: the station id of
  // transport.opendata.ch
  CodeNat: Schema.optionalKey(Schema.String),
});
export type Target = typeof Target.Type;

// Stop as returned by GETFULLTARGETS
export const FullTarget = Schema.Struct({
  Name: Schema.String,
  Label: Schema.String,
  Identifiers: Schema.Array(
    Schema.Struct({
      Id: Schema.String,
      Code: Schema.String,
      CodeNat: Schema.optionalKey(Schema.String),
      // WGS84 degrees as strings, "0.0" when unknown
      Lat: Schema.optionalKey(Schema.String),
      Lon: Schema.optionalKey(Schema.String),
      // "TPL"
      Basin: Schema.optionalKey(Schema.String),
      // The lines stopping at the platform: {"dir": 1, "uid": 26, "des":
      // "Viganello"}, one per destination
      RoutesDirections: Schema.optionalKey(Schema.Array(Schema.Unknown)),
    })
  ),
});
export type FullTarget = typeof FullTarget.Type;

export const Itinerary = Schema.Struct({
  Target: Schema.String,
  Route: Schema.String,
  RouteCode: Schema.String,
  Dir: Schema.String,
  Routing: Schema.String,
  Dest: Schema.String,
  Img: Schema.String,
  Time: Schema.String,
  Pred: Schema.Enum(InTimeStatus),
  // Seconds until the departure, relative to the response
  Wait: Schema.optionalKey(Schema.Number),
  // Trip identifier, stable while the bus approaches the stop
  Uid: Schema.optionalKey(Schema.Number),
});
export type Itinerary = typeof Itinerary.Type;

export const RoutingStop = Schema.Struct({
  UID: Schema.String,
  Code: Schema.String,
  Name: Schema.String,
  Label: Schema.String,
  Time: Schema.String,
  Status: Schema.Enum(RoutingStatus),
  Pred: Schema.Enum(InTimeStatus),
});
export type RoutingStop = typeof RoutingStop.Type;

export const RtpiResponse = <S extends Schema.Top>(item: S) =>
  Schema.Struct({
    status: Schema.Literal("OK"),
    // Session id to send back as `source` in the next request
    source: Schema.String,
    // Only on monitored requests: "KO" while the data is not ready yet
    validity: Schema.optionalKey(Schema.Literals(["OK", "KO"])),
    data: Schema.Array(item),
    // Only on GETROUTING, of the vehicle running the trip (as read in the
    // official app): numbers or text, checked when used
    itinerary: Schema.optionalKey(Schema.Unknown),
    vehicle: Schema.optionalKey(Schema.Unknown),
    lastcom: Schema.optionalKey(Schema.Unknown),
    delay: Schema.optionalKey(Schema.Unknown),
    distanceperc: Schema.optionalKey(Schema.Unknown),
    latitude: Schema.optionalKey(Schema.Unknown),
    longitude: Schema.optionalKey(Schema.Unknown),
  });

// A line of GETROUTES: {"Uid": 23, "Code": "5", "ShortCode": "5",
// "Description": "Viganello San Siro - Lamone Cadempino", "Backcolor":
// "0068ac", "Forecolor": "ffffff", …}. Types checked by `toLines`.
export const RtpiRoute = Schema.Struct({
  Uid: Schema.optionalKey(Schema.Unknown),
  Code: Schema.optionalKey(Schema.Unknown),
  ShortCode: Schema.optionalKey(Schema.Unknown),
  Description: Schema.optionalKey(Schema.Unknown),
  Backcolor: Schema.optionalKey(Schema.Unknown),
  Forecolor: Schema.optionalKey(Schema.Unknown),
});
export type RtpiRoute = typeof RtpiRoute.Type;

// GETROUTES answers the lines by basin: {"data": {"TPL": [...]}}
export const RoutesResponse = Schema.Struct({
  status: Schema.Literal("OK"),
  data: Schema.Record(Schema.String, Schema.Array(RtpiRoute)),
});

// Non-negative integer identifiers coming from query strings
export const Identifier = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
);
