import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";
import type { Vehicle } from "./models";
import { rtpiNumber, rtpiText } from "./rtpi-values";
import {
  FullTarget,
  Itinerary,
  RoutingStop,
  RoutesResponse,
  RtpiResponse,
  type RtpiRoute,
} from "./schema";

// Client for the TEQ "Bus Sapiens" RTPI server used by the official TPL Bus
// app (ch.teq.TplBs). The old http://bs.tplsa.ch/RTPI/rtpi endpoint no longer
// returns real-time data. Requests are a JS-object-like message sent as the
// `data` query parameter.
//
// Protocol notes:
// - `source` is the session id. An empty source makes the server open a new
//   session, returned in `source` of the response.
// - GETITINERARIES and GETROUTING start a real-time monitor for that session.
//   Until the monitor has data the server answers `validity: "KO"`; the
//   official clients poll again every 500ms.
// - `validity: "OK"` with an empty `data` means there is nothing to show
//   (e.g. no buses expected soon), not an invalid session.

// HTTPS, as in the configuration of the official app 4.0.12
// (bussapiens/4.0.10/tpl/config.json, `network.rtpiBaseUrl`)
export const RTPI_URL = "https://arcobaleno.teqmonitoring.com/RTPI-ARC/rtpi";
const BASIN = "TPL";

export type RtpiType = "GETFULLTARGETS" | "GETROUTES" | "GETITINERARIES" | "GETROUTING";

export function rtpiMessage(
  type: RtpiType,
  source: string,
  parameters: ReadonlyArray<number> = []
): string {
  if (type === "GETFULLTARGETS") {
    // crc:0 always returns the full list (the app sends its cached CRC)
    return `{basin:'${BASIN}',reqbasin:'${BASIN}',source:'${source}',destination:0,type:GETFULLTARGETS,data:{crc:0}}`;
  }
  // As built by the official app 4.0.12
  if (type === "GETROUTES") {
    return `{source:"${source}",destination:0,reqbasins:"${BASIN}",type:GETROUTES}`;
  }
  return `{source:"${source}",destination:0,type:${type},data:{parameters:[${parameters.join(",")}]}}`;
}

// Response of a monitored request (itineraries, routing)
export interface Monitor<A> {
  readonly source: string;
  readonly ready: boolean;
  readonly data: ReadonlyArray<A>;
  readonly vehicle?: Vehicle;
}

// The vehicle of a routing, from the fields next to its stops, all text:
// {"vehicle": "236", "lastcom": "21:13:14", "delay": "375", "distanceperc":
// "0.769", "latitude": "46.0310", "longitude": "8.9363"}. A position only
// with a GPS fix: "0.0" before the trip starts.
export function toVehicle(response: {
  readonly vehicle?: unknown;
  readonly lastcom?: unknown;
  readonly delay?: unknown;
  readonly distanceperc?: unknown;
  readonly latitude?: unknown;
  readonly longitude?: unknown;
}): Vehicle | undefined {
  const lat = rtpiNumber(response.latitude);
  const lon = rtpiNumber(response.longitude);
  const vehicle: Vehicle = {
    ...(rtpiText(response.vehicle) && { vehicle: rtpiText(response.vehicle) }),
    ...(rtpiText(response.lastcom) && { lastcom: rtpiText(response.lastcom) }),
    ...(rtpiNumber(response.delay) !== undefined && {
      delaySeconds: rtpiNumber(response.delay),
    }),
    ...(rtpiNumber(response.distanceperc) !== undefined && {
      progress: rtpiNumber(response.distanceperc),
    }),
    ...(lat !== undefined &&
      lon !== undefined &&
      lat !== 0 &&
      lon !== 0 &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180 && { position: { lat, lon } }),
  };
  return Object.keys(vehicle).length > 0 ? vehicle : undefined;
}



export class RtpiError extends Schema.TaggedError<RtpiError>()("RtpiError", {
  type: Schema.String,
  cause: Schema.Defect(),
}) {}

export class RtpiClient extends Context.Service<
  RtpiClient,
  {
    readonly fullTargets: Effect.Effect<ReadonlyArray<FullTarget>, RtpiError>;
    // The lines of TPL
    readonly routes: Effect.Effect<ReadonlyArray<RtpiRoute>, RtpiError>;
    itineraries(
      source: string,
      targets: ReadonlyArray<number>
    ): Effect.Effect<Monitor<Itinerary>, RtpiError>;
    routing(
      source: string,
      parameters: ReadonlyArray<number>
    ): Effect.Effect<Monitor<RoutingStop>, RtpiError>;
  }
>()("lugano-timetable/timetable/RtpiClient") {
  static readonly layerNoDeps = Layer.effect(
    RtpiClient,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({
          schedule: Schedule.exponential("200 millis"),
          times: 2,
        })
      );

      const request = <S extends Schema.Top>(
        type: RtpiType,
        item: S,
        source = "",
        parameters?: ReadonlyArray<number>
      ) =>
        client
          .get(RTPI_URL, {
            urlParams: { data: rtpiMessage(type, source, parameters) },
          })
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(RtpiResponse(item))),
            Effect.timeout("5 seconds"),
            Effect.mapError((cause) => new RtpiError({ type, cause })),
            Effect.withSpan(`RtpiClient.${type}`, { attributes: { parameters } })
          );


      const monitor = <S extends Schema.Top>(
        type: "GETITINERARIES" | "GETROUTING",
        item: S,
        source: string,
        parameters: ReadonlyArray<number>
      ) =>
        request(type, item, source, parameters).pipe(
          Effect.map(
            (response): Monitor<S["Type"]> => {
              const vehicle = type === "GETROUTING" ? toVehicle(response) : undefined;
              return {
                source: response.source,
                ready: response.validity !== "KO",
                data: response.data,
                ...(vehicle && { vehicle }),
              };
            }
          )
        );

      return RtpiClient.of({
        fullTargets: request("GETFULLTARGETS", FullTarget).pipe(
          Effect.map((response) => response.data)
        ),
        routes: client
          .get(RTPI_URL, { urlParams: { data: rtpiMessage("GETROUTES", "") } })
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(RoutesResponse)),
            Effect.map((response) => response.data.TPL ?? []),
            Effect.timeout("10 seconds"),
            Effect.mapError((cause) => new RtpiError({ type: "GETROUTES", cause })),
            Effect.withSpan("RtpiClient.GETROUTES")
          ),
        itineraries: (source, targets) =>
          monitor("GETITINERARIES", Itinerary, source, targets),
        routing: (source, parameters) =>
          monitor("GETROUTING", RoutingStop, source, parameters),
      });
    })
  );

  static readonly layer = RtpiClient.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
