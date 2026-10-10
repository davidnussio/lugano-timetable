import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";
import {
  FullTarget,
  Itinerary,
  RoutingStop,
  RtpiResponse,
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

export type RtpiType = "GETFULLTARGETS" | "GETITINERARIES" | "GETROUTING";

export function rtpiMessage(
  type: RtpiType,
  source: string,
  parameters: ReadonlyArray<number> = []
): string {
  if (type === "GETFULLTARGETS") {
    // crc:0 always returns the full list (the app sends its cached CRC)
    return `{basin:'${BASIN}',reqbasin:'${BASIN}',source:'${source}',destination:0,type:GETFULLTARGETS,data:{crc:0}}`;
  }
  return `{source:"${source}",destination:0,type:${type},data:{parameters:[${parameters.join(",")}]}}`;
}

// Response of a monitored request (itineraries, routing)
export interface Monitor<A> {
  readonly source: string;
  readonly ready: boolean;
  readonly data: ReadonlyArray<A>;
}

export class RtpiError extends Schema.TaggedError<RtpiError>()("RtpiError", {
  type: Schema.String,
  cause: Schema.Defect(),
}) {}

export class RtpiClient extends Context.Service<
  RtpiClient,
  {
    readonly fullTargets: Effect.Effect<ReadonlyArray<FullTarget>, RtpiError>;
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
        type: Exclude<RtpiType, "GETFULLTARGETS">,
        item: S,
        source: string,
        parameters: ReadonlyArray<number>
      ) =>
        request(type, item, source, parameters).pipe(
          Effect.map(
            (response): Monitor<S["Type"]> => ({
              source: response.source,
              ready: response.validity !== "KO",
              data: response.data,
            })
          )
        );

      return RtpiClient.of({
        fullTargets: request("GETFULLTARGETS", FullTarget).pipe(
          Effect.map((response) => response.data)
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
