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

// Answers of the requests that are not monitored, read as the official app
// reads them: only `data`
export const RtpiData = <S extends Schema.Top>(item: S) =>
  Schema.Struct({ data: Schema.Array(item) });

// A line, from GETROUTES. The types of the values are not documented:
// numbers or text, normalized by `toLine`.
export const RtpiRoute = Schema.Struct({
  Uid: Schema.optionalKey(Schema.Unknown),
  Code: Schema.optionalKey(Schema.Unknown),
  // "6", as written on the bus
  ShortCode: Schema.optionalKey(Schema.Unknown),
  Description: Schema.optionalKey(Schema.Unknown),
  Backcolor: Schema.optionalKey(Schema.Unknown),
  Forecolor: Schema.optionalKey(Schema.Unknown),
  Basin: Schema.optionalKey(Schema.Unknown),
});
export type RtpiRoute = typeof RtpiRoute.Type;

// A stop of GETTARGETS with, for each platform, the lines and directions
// stopping there
export const RouteDirection = Schema.Struct({
  uid: Schema.optionalKey(Schema.Unknown),
  dir: Schema.optionalKey(Schema.Unknown),
  des: Schema.optionalKey(Schema.Unknown),
});

export const TargetRoutes = Schema.Struct({
  Name: Schema.optionalKey(Schema.Unknown),
  Identifiers: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        Id: Schema.optionalKey(Schema.Unknown),
        Basin: Schema.optionalKey(Schema.Unknown),
        RoutesDirections: Schema.optionalKey(Schema.Array(RouteDirection)),
      })
    )
  ),
});
export type TargetRoutes = typeof TargetRoutes.Type;

// Non-negative integer identifiers coming from query strings
export const Identifier = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
);
