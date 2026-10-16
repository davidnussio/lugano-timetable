import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";
import type { Station } from "~/journey/models";

// Client for the services of swisstopo: the altitude of the ground at a point
// of Switzerland, from its terrain model, for the climb of the walk to the
// stop; the public transport stops of every operator, for the map.
export const HEIGHT_URL = "https://api3.geo.admin.ch/rest/services/height";
export const IDENTIFY_URL =
  "https://api3.geo.admin.ch/rest/services/api/MapServer/identify";

// The stops of the Federal Office of Transport over Ticino (and the edges of
// Grisons): about 2000, with 3700 platforms. The service answers at most 200
// results, in no stable order: its pages skip and repeat results. The area
// is asked in boxes instead, those with too many results in quarters.
const STOPS_LAYER = "ch.bav.haltestellen-oev";
// West, south, east, north
type Box = readonly [number, number, number, number];
const TICINO: Box = [8.38, 45.81, 9.17, 46.64];
const STOPS_GRID = 4;
const STOPS_LIMIT = 200;
const STOPS_CONCURRENCY = 8;
// Degrees, about 50 m: no smaller boxes, whatever the answer
const MIN_BOX = 0.0005;

function quarters([west, south, east, north]: Box): ReadonlyArray<Box> {
  const x = (west + east) / 2;
  const y = (south + north) / 2;
  return [
    [west, south, x, y],
    [x, south, east, y],
    [west, y, x, north],
    [x, y, east, north],
  ];
}

function grid([west, south, east, north]: Box, size: number): ReadonlyArray<Box> {
  const width = (east - west) / size;
  const height = (north - south) / size;
  return Array.from({ length: size * size }, (_, i) => {
    const x = west + (i % size) * width;
    const y = south + Math.floor(i / size) * height;
    return [x, y, x + width, y + height] as const;
  });
}

export class SwisstopoError extends Schema.TaggedError<SwisstopoError>()(
  "SwisstopoError",
  {
    cause: Schema.Defect(),
  }
) {}

// The height comes as a string ("273.4"), accept a number as well
const HeightResponse = Schema.Struct({
  height: Schema.Union([Schema.Number, Schema.NumberFromString]),
});

const Nullable = <S extends Schema.Top>(schema: S) =>
  Schema.optionalKey(Schema.NullOr(schema));

// The layer has the stops, by their national code (as transport.opendata.ch),
// and their platforms, by a text id ("ch:1:sloid:…"): only the stops are kept
const IdentifyResponse = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      id: Schema.Union([Schema.Number, Schema.String]),
      geometry: Schema.Struct({
        coordinates: Schema.Array(Schema.Array(Schema.Number)),
      }),
      properties: Schema.Struct({
        name: Nullable(Schema.String),
        // "Bus", "Zug", "Schiff"…: empty for the stops without service
        verkehrsmittel_de: Nullable(Schema.String),
      }),
    })
  ),
});
type IdentifyResult = (typeof IdentifyResponse.Type)["results"][number];

// The icons of transport.opendata.ch
const ICONS: Record<string, string> = {
  Bus: "bus",
  Zug: "train",
  Tram: "tram",
  Schiff: "ship",
};

export function toStop({ id, geometry, properties }: IdentifyResult): Station | undefined {
  const [point] = geometry.coordinates;
  const means = properties.verkehrsmittel_de;
  if (typeof id !== "number" || !properties.name || !means || !point) return undefined;
  const [lon, lat] = point;
  // Several means ("Bus / Zug"): the first one
  const icon = ICONS[means.split(" / ")[0]] ?? "cableway";
  return { id: String(id), name: properties.name, position: { lat, lon }, icon };
}

// WGS84 to the Swiss coordinates (LV95) with the approximate formulas of
// swisstopo, within a meter: the service does not take degrees
export function toLv95(lat: number, lon: number): { readonly east: number; readonly north: number } {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lambda = (lon * 3600 - 26782.5) / 10000;
  return {
    east:
      2600072.37 +
      211455.93 * lambda -
      10938.51 * lambda * phi -
      0.36 * lambda * phi ** 2 -
      44.54 * lambda ** 3,
    north:
      1200147.07 +
      308807.95 * phi +
      3745.25 * lambda ** 2 +
      76.63 * phi ** 2 -
      194.56 * lambda ** 2 * phi +
      119.79 * phi ** 3,
  };
}

export class Swisstopo extends Context.Service<
  Swisstopo,
  {
    // Meters above the sea, outside of Switzerland a failure
    height(lat: number, lon: number): Effect.Effect<number, SwisstopoError>;
    // The public transport stops of Ticino, of every operator
    stops(): Effect.Effect<ReadonlyArray<Station>, SwisstopoError>;
  }
>()("lugano-timetable/terrain/Swisstopo") {
  static readonly layerNoDeps = Layer.effect(
    Swisstopo,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({
          schedule: Schedule.exponential("300 millis"),
          times: 1,
        })
      );

      const identify = (box: Box) => {
        const urlParams = {
          layers: `all:${STOPS_LAYER}`,
          geometryType: "esriGeometryEnvelope",
          geometry: box.join(","),
          sr: "4326",
          tolerance: "0",
          returnGeometry: "true",
          geometryFormat: "geojson",
          limit: String(STOPS_LIMIT),
        };
        return client.get(IDENTIFY_URL, { urlParams }).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(IdentifyResponse)),
          Effect.map((response) => response.results),
          Effect.timeout("15 seconds"),
          Effect.mapError((cause) => new SwisstopoError({ cause })),
          Effect.withSpan("Swisstopo.stops", { attributes: urlParams })
        );
      };

      // Everything in a box, the full answers asked again in quarters
      const stopsIn = (
        box: Box
      ): Effect.Effect<ReadonlyArray<IdentifyResult>, SwisstopoError> =>
        identify(box).pipe(
          Effect.flatMap((results) =>
            results.length < STOPS_LIMIT || box[2] - box[0] < MIN_BOX
              ? Effect.succeed(results)
              : Effect.forEach(quarters(box), stopsIn, {
                  concurrency: STOPS_CONCURRENCY,
                }).pipe(Effect.map((parts) => parts.flat()))
          )
        );

      return Swisstopo.of({
        height: (lat, lon) => {
          const { east, north } = toLv95(lat, lon);
          const urlParams = {
            easting: east.toFixed(1),
            northing: north.toFixed(1),
            sr: "2056",
          };
          return client.get(HEIGHT_URL, { urlParams }).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(HeightResponse)),
            Effect.map((response) => response.height),
            Effect.timeout("5 seconds"),
            Effect.mapError((cause) => new SwisstopoError({ cause })),
            Effect.withSpan("Swisstopo.height", { attributes: urlParams })
          );
        },
        // The stops on the edge of two boxes come twice: by id, each once
        stops: () =>
          Effect.forEach(grid(TICINO, STOPS_GRID), stopsIn, {
            concurrency: STOPS_CONCURRENCY,
          }).pipe(
            Effect.map((parts) => {
              const stops = new Map<string, Station>();
              for (const stop of parts.flat().map(toStop)) {
                if (stop) stops.set(stop.id, stop);
              }
              return [...stops.values()];
            })
          ),
      });
    })
  );

  static readonly layer = Swisstopo.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
