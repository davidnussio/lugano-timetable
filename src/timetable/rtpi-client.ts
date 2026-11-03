import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
} from "effect/http";
import type { Vehicle } from "./models";
import { rtpiNumber, rtpiText } from "./rtpi-values";
import {
  FullTarget,
  Itinerary,
  RoutingStop,
  RtpiData,
  RtpiResponse,
  RtpiRoute,
  TargetRoutes,
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

export const RTPI_URL = "http://arcobaleno.teqmonitoring.com/RTPI-ARC/rtpi";
const BASIN = "TPL";

export type RtpiType =
  | "GETFULLTARGETS"
  | "GETTARGETS"
  | "GETROUTES"
  | "GETITINERARIES"
  | "GETROUTING";

export function rtpiMessage(
  type: RtpiType,
  source: string,
  parameters: ReadonlyArray<number> = []
): string {
  if (type === "GETFULLTARGETS") {
    // crc:0 always returns the full list (the app sends its cached CRC)
    return `{basin:'${BASIN}',reqbasin:'${BASIN}',source:'${source}',destination:0,type:GETFULLTARGETS,data:{crc:0}}`;
  }
  // As built by the official app 4.0.12: the stops with the lines of each
  // platform, and the lines of the basins
  if (type === "GETTARGETS") {
    return `{source:"${source}",destination:0,type:GETTARGETS}`;
  }
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

// The vehicle of a routing, from the fields next to its stops: a position
// only with a GPS fix (the official app treats 0 as none)
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
      distancePercent: rtpiNumber(response.distanceperc),
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

// The answers not seen yet by this server process, to log once: the
// requests copied from the official app were never tried before
const logged = new Set<RtpiType>();
const SAMPLE_LENGTH = 2000;

const logFirstAnswer = (type: RtpiType, body: unknown) =>
  type === "GETFULLTARGETS" || type === "GETITINERARIES" || logged.has(type)
    ? Effect.void
    : Effect.suspend(() => {
        logged.add(type);
        const { data, ...rest } = (body ?? {}) as { data?: unknown };
        const first = Array.isArray(data) ? data.slice(0, 2) : data;
        return Effect.logInfo(
          `RTPI ${type} answer: ${JSON.stringify({ ...rest, count: Array.isArray(data) ? data.length : undefined, data: first }).slice(0, SAMPLE_LENGTH)}`
        );
      });

export class RtpiError extends Schema.TaggedError<RtpiError>()("RtpiError", {
  type: Schema.String,
  cause: Schema.Defect(),
}) {}

export class RtpiClient extends Context.Service<
  RtpiClient,
  {
    readonly fullTargets: Effect.Effect<ReadonlyArray<FullTarget>, RtpiError>;
    // The stops with the lines and directions of each platform
    readonly targetRoutes: Effect.Effect<ReadonlyArray<TargetRoutes>, RtpiError>;
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
            Effect.flatMap((response) => response.json),
            Effect.tap((body) => logFirstAnswer(type, body)),
            Effect.flatMap(Schema.decodeUnknownEffect(RtpiResponse(item))),
            Effect.timeout("5 seconds"),
            Effect.mapError((cause) => new RtpiError({ type, cause })),
            Effect.withSpan(`RtpiClient.${type}`, { attributes: { parameters } })
          );

      // Not monitored, read like the official app: only `data`
      const list = <S extends Schema.Top>(type: "GETTARGETS" | "GETROUTES", item: S) =>
        client.get(RTPI_URL, { urlParams: { data: rtpiMessage(type, "") } }).pipe(
          Effect.flatMap((response) => response.json),
          Effect.tap((body) => logFirstAnswer(type, body)),
          Effect.flatMap(Schema.decodeUnknownEffect(RtpiData(item))),
          Effect.map((response) => response.data),
          Effect.timeout("10 seconds"),
          Effect.mapError((cause) => new RtpiError({ type, cause })),
          Effect.withSpan(`RtpiClient.${type}`)
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
        targetRoutes: list("GETTARGETS", TargetRoutes),
        routes: list("GETROUTES", RtpiRoute),
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
