import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";

// Client for the height service of swisstopo: the altitude of the ground at a
// point of Switzerland, from its terrain model. Used for the climb of the
// walk to the stop.
export const HEIGHT_URL = "https://api3.geo.admin.ch/rest/services/height";

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
      });
    })
  );

  static readonly layer = Swisstopo.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
