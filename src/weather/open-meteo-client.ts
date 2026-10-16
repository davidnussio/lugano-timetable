import { Context, Effect, Layer, Schedule, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/http";

// Client for the forecast of Open-Meteo, free and without a key: for
// Switzerland it serves the ICON-CH models of MeteoSwiss. Used for the rain
// and the snow that slow down the walk to the stop.
export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export class OpenMeteoError extends Schema.TaggedError<OpenMeteoError>()(
  "OpenMeteoError",
  {
    cause: Schema.Defect(),
  }
) {}

// A value the model does not have comes as null
const Amount = Schema.NullOr(Schema.Number);

// The current conditions are sums over the last `interval` seconds (15
// minutes): millimeters of water, centimeters of snow, and the WMO code
const ForecastResponse = Schema.Struct({
  current: Schema.Struct({
    interval: Schema.optional(Schema.Number),
    precipitation: Amount,
    snowfall: Amount,
    weather_code: Amount,
  }),
});

export interface CurrentWeather {
  // Millimeters of rain, showers and snow (as water) per hour
  readonly precipitation: number;
  // Centimeters of snow per hour
  readonly snowfall: number;
  // WMO weather interpretation code, 0 for a clear sky
  readonly code: number;
}

export class OpenMeteo extends Context.Service<
  OpenMeteo,
  {
    current(lat: number, lon: number): Effect.Effect<CurrentWeather, OpenMeteoError>;
  }
>()("lugano-timetable/weather/OpenMeteo") {
  static readonly layerNoDeps = Layer.effect(
    OpenMeteo,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({
          schedule: Schedule.exponential("300 millis"),
          times: 1,
        })
      );

      return OpenMeteo.of({
        current: (lat, lon) => {
          const urlParams = {
            latitude: lat.toFixed(2),
            longitude: lon.toFixed(2),
            current: "precipitation,rain,showers,snowfall,weather_code",
            timezone: "Europe/Zurich",
          };
          return client.get(FORECAST_URL, { urlParams }).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(ForecastResponse)),
            Effect.map(({ current }) => {
              // Rates per hour, whatever the step of the model
              const perHour = 3600 / (current.interval ?? 3600);
              return {
                precipitation: (current.precipitation ?? 0) * perHour,
                snowfall: (current.snowfall ?? 0) * perHour,
                code: current.weather_code ?? 0,
              };
            }),
            Effect.timeout("5 seconds"),
            Effect.mapError((cause) => new OpenMeteoError({ cause })),
            Effect.withSpan("OpenMeteo.current", { attributes: urlParams })
          );
        },
      });
    })
  );

  static readonly layer = OpenMeteo.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
