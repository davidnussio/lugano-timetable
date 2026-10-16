import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { HEIGHT_URL, Swisstopo, toLv95 } from "../swisstopo-client";

// HttpClient answering with `respond(url)`, recording the requested URLs
const fakeHttp = (respond: (url: URL) => Response, requested: Array<URL>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requested.push(url);
      return Effect.succeed(HttpClientResponse.fromWeb(request, respond(url)));
    })
  );

const swisstopo = (respond: (url: URL) => Response, requested: Array<URL> = []) =>
  Swisstopo.layerNoDeps.pipe(Layer.provide(fakeHttp(respond, requested)));

describe("toLv95", () => {
  it("converts degrees as in the example of swisstopo", () => {
    // 46° 2' 38.87" N, 8° 43' 49.79" E
    const { east, north } = toLv95(46 + 2 / 60 + 38.87 / 3600, 8 + 43 / 60 + 49.79 / 3600);
    assert.closeTo(east, 2699999.76, 1);
    assert.closeTo(north, 1099999.97, 1);
  });
});

describe("Swisstopo", () => {
  it.effect("asks the height of a point in Swiss coordinates", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Swisstopo;
      const height = yield* client.height(46.00495, 8.95153);
      assert.strictEqual(height, 273.4);
      const url = requested[0];
      assert.strictEqual(`${url.origin}${url.pathname}`, HEIGHT_URL);
      assert.strictEqual(url.searchParams.get("sr"), "2056");
      assert.closeTo(Number(url.searchParams.get("easting")), 2717600, 1000);
      assert.closeTo(Number(url.searchParams.get("northing")), 1095900, 1000);
    }).pipe(Effect.provide(swisstopo(() => Response.json({ height: "273.4" }), requested)));
  });

  it.effect("fails outside of Switzerland", () =>
    Effect.gen(function* () {
      const client = yield* Swisstopo;
      const error = yield* Effect.flip(client.height(45.4642, 9.19));
      assert.strictEqual(error._tag, "SwisstopoError");
    }).pipe(
      Effect.provide(
        swisstopo(() =>
          Response.json({ detail: "Requested coordinate out of bounds" }, { status: 400 })
        )
      )
    )
  );
});
