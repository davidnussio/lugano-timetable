import { Schema } from "effect";
import { InTimeStatus, RoutingStatus } from "./models";

// Only the fields used by the app are declared: everything else returned by
// the RTPI server is dropped while decoding.

export const Target = Schema.Struct({
  Name: Schema.String,
  Label: Schema.String,
  Identifiers: Schema.Array(Schema.String),
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
  });

// Non-negative integer identifiers coming from query strings
export const Identifier = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
);
