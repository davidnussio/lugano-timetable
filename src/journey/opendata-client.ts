import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";
import {
  opendataDateAndTime,
  opendataDateTime,
  toConnection,
  toLegUpdate,
  toStation,
  toStationDeparture,
} from "./convert";
import type {
  Connection,
  LegUpdate,
  Station,
  StationDeparture,
} from "./models";
import {
  ConnectionsResponse,
  LocationsResponse,
  StationboardResponse,
} from "./schema";

// Client for transport.opendata.ch: stop search, journey planning and the
// departures of a stop, with the real-time forecasts of every operator (TPL
// included). The service is slow and sometimes answers 504: requests time
// out and the callers keep their last data.
export const OPENDATA_URL = "https://transport.opendata.ch/v1";

export type StationQuery =
  | { readonly query: string }
  | { readonly lat: number; readonly lon: number };

// A planned leg to look up again: boarding stop, trip number, scheduled
// departure (epoch milliseconds) and the stop where the leg ends
export interface LegQuery {
  readonly from: string;
  readonly trip: string;
  readonly at: number;
  readonly to: string;
}

export class OpendataError extends Schema.TaggedError<OpendataError>()(
  "OpendataError",
  {
    endpoint: Schema.String,
    cause: Schema.Defect(),
  }
) {}

const isDefined = <A>(value: A | undefined): value is A => value !== undefined;

const CONNECTIONS = 5;
const STATIONS = 10;
// Departures listed after the scheduled time of a leg: enough for the
// busiest stops, where several lines leave in the same minute
const STATIONBOARD = 20;

export class Opendata extends Context.Service<
  Opendata,
  {
    stations(
      query: StationQuery
    ): Effect.Effect<ReadonlyArray<Station>, OpendataError>;
    // Journeys leaving from `from` at `at` (epoch milliseconds) or later
    // Leaving from `at` (now when missing), or arriving by it
    connections(
      from: string,
      to: string,
      at?: number,
      arrival?: boolean
    ): Effect.Effect<ReadonlyArray<Connection>, OpendataError>;
    // Latest timings of planned legs: `null` for the legs not found
    legs(legs: ReadonlyArray<LegQuery>): Effect.Effect<ReadonlyArray<LegUpdate>>;
    // The next `limit` departures of a stop, of every operator and means
    stationboard(
      id: string,
      limit: number
    ): Effect.Effect<ReadonlyArray<StationDeparture>, OpendataError>;
  }
>()("lugano-timetable/journey/Opendata") {
  static readonly layerNoDeps = Layer.effect(
    Opendata,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({
          schedule: Schedule.exponential("300 millis"),
          times: 1,
        })
      );

      const request = <S extends Schema.Top>(
        endpoint: "locations" | "connections" | "stationboard",
        schema: S,
        urlParams: Record<string, string>
      ) =>
        client.get(`${OPENDATA_URL}/${endpoint}`, { urlParams }).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
          Effect.timeout("15 seconds"),
          Effect.mapError((cause) => new OpendataError({ endpoint, cause })),
          Effect.withSpan(`Opendata.${endpoint}`, { attributes: urlParams })
        );

      const leg = (query: LegQuery) =>
        request("stationboard", StationboardResponse, {
          id: query.from,
          datetime: opendataDateTime(query.at),
          limit: String(STATIONBOARD),
        }).pipe(
          Effect.map((response) =>
            toLegUpdate(response.stationboard, query.trip, query.to)
          ),
          Effect.catch((error) =>
            Effect.as(
              Effect.logWarning(`Failed to refresh a journey leg: ${String(error.cause)}`, error),
              null
            )
          )
        );

      return Opendata.of({
        stations: (query) =>
          request(
            "locations",
            LocationsResponse,
            "query" in query
              ? { query: query.query, type: "station" }
              : { x: String(query.lat), y: String(query.lon), type: "station" }
          ).pipe(
            Effect.map((response) =>
              response.stations
                .map(toStation)
                .filter(isDefined)
                .slice(0, STATIONS)
            )
          ),
        connections: (from, to, at, arrival = false) =>
          request("connections", ConnectionsResponse, {
            from,
            to,
            limit: String(CONNECTIONS),
            ...(at === undefined ? {} : opendataDateAndTime(at)),
            ...(arrival ? { isArrivalTime: "1" } : {}),
          }).pipe(
            Effect.map((response) =>
              response.connections.map(toConnection).filter(isDefined)
            )
          ),
        legs: (legs) => Effect.forEach(legs, leg, { concurrency: "unbounded" }),
        stationboard: (id, limit) =>
          request("stationboard", StationboardResponse, {
            id,
            limit: String(limit),
          }).pipe(
            Effect.map((response) =>
              response.stationboard.map(toStationDeparture).filter(isDefined)
            )
          ),
      });
    })
  );

  static readonly layer = Opendata.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
