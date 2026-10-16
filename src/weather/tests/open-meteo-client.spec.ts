import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { FORECAST_URL, OpenMeteo } from "../open-meteo-client";

// HttpClient answering with `respond(url)`, recording the requested URLs
const fakeHttp = (respond: (url: URL) => Response, requested: Array<URL>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requested.push(url);
      return Effect.succeed(HttpClientResponse.fromWeb(request, respond(url)));
    })
  );

const openMeteo = (respond: (url: URL) => Response, requested: Array<URL> = []) =>
  OpenMeteo.layerNoDeps.pipe(Layer.provide(fakeHttp(respond, requested)));

// As documented by Open-Meteo, here 15 minutes of moderate rain
const forecast = {
  latitude: 46,
  longitude: 8.94,
  timezone: "Europe/Zurich",
  current_units: {
    time: "iso8601",
    interval: "seconds",
    precipitation: "mm",
    rain: "mm",
    showers: "mm",
    snowfall: "cm",
    weather_code: "wmo code",
  },
  current: {
    time: "2026-10-16T08:15",
    interval: 900,
    precipitation: 0.6,
    rain: 0.6,
    showers: 0,
    snowfall: 0,
    weather_code: 63,
  },
};

describe("OpenMeteo", () => {
  it.effect("asks the current weather and gives the rates per hour", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* OpenMeteo;
      const weather = yield* client.current(46.0049, 8.9515);
      assert.deepStrictEqual(weather, { precipitation: 2.4, snowfall: 0, code: 63 });
      const url = requested[0];
      assert.strictEqual(`${url.origin}${url.pathname}`, FORECAST_URL);
      assert.strictEqual(url.searchParams.get("latitude"), "46.00");
      assert.strictEqual(url.searchParams.get("longitude"), "8.95");
      assert.strictEqual(url.searchParams.get("timezone"), "Europe/Zurich");
      assert.include(url.searchParams.get("current") ?? "", "weather_code");
    }).pipe(Effect.provide(openMeteo(() => Response.json(forecast), requested)));
  });

  it.effect("reads the missing values as none", () =>
    Effect.gen(function* () {
      const client = yield* OpenMeteo;
      const weather = yield* client.current(46, 8.95);
      assert.deepStrictEqual(weather, { precipitation: 0, snowfall: 0, code: 0 });
    }).pipe(
      Effect.provide(
        openMeteo(() =>
          Response.json({
            current: { precipitation: null, snowfall: null, weather_code: null },
          })
        )
      )
    )
  );

  it.effect("fails on an error of the service", () =>
    Effect.gen(function* () {
      const client = yield* OpenMeteo;
      const error = yield* Effect.flip(client.current(46, 8.95));
      assert.strictEqual(error._tag, "OpenMeteoError");
    }).pipe(
      Effect.provide(
        openMeteo(() =>
          Response.json({ error: true, reason: "Latitude must be in range" }, { status: 400 })
        )
      )
    )
  );
});
