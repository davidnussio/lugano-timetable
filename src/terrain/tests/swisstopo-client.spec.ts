import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { HEIGHT_URL, IDENTIFY_URL, Swisstopo, toLv95 } from "../swisstopo-client";

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

  it.effect("lists every stop in boxes, without their platforms", () => {
    const requested: Array<URL> = [];
    const feature = (
      id: number | string,
      name: string,
      means: string | null,
      lon: number,
      lat: number,
      operator: string | null = "PAG"
    ) => ({
      id,
      geometry: { type: "MultiPoint", coordinates: [[lon, lat]] },
      properties: { name, verkehrsmittel_de: means, tuabkuerzung: operator },
    });
    // 500 bus stops and their platforms around Lugano, too many for a box
    // of the grid, and a few other stops
    const features = [
      ...Array.from({ length: 500 }, (_, i) => [
        feature(8500000 + i, `Stop ${i}`, "Bus", 8.9 + (i % 25) * 0.004, 46 + Math.floor(i / 25) * 0.004),
        feature(`ch:1:sloid:${i}:0:1`, `Stop ${i}`, null, 8.9 + (i % 25) * 0.004, 46 + Math.floor(i / 25) * 0.004),
      ]).flat(),
      feature(8505000, "Bellinzona", "Zug", 9.0293, 46.1955, "SBB CFF FFS"),
      feature(8505001, "Without service", "", 9.03, 46.2),
      feature(8575302, "Monte Brè", "Standseilbahn", 8.9707, 46.0109, "XYZ"),
      feature(8575303, "Unknown company", "Bus", 8.97, 46.01, null),
    ];
    // The features in the box, at most 200 and in no stable order
    const identify = (url: URL) => {
      const [west, south, east, north] = (url.searchParams.get("geometry") ?? "").split(",").map(Number);
      const inside = features.filter(({ geometry: { coordinates: [[lon, lat]] } }) =>
        lon >= west && lon <= east && lat >= south && lat <= north
      );
      return Response.json({ results: inside.sort(() => Math.random() - 0.5).slice(0, 200) });
    };
    return Effect.gen(function* () {
      const client = yield* Swisstopo;
      const stops = yield* client.stops();
      assert.strictEqual(stops.length, 503);
      assert.deepStrictEqual(stops.find((stop) => stop.id === "8505000"), {
        id: "8505000",
        name: "Bellinzona",
        position: { lat: 46.1955, lon: 9.0293 },
        icon: "train",
        operator: "FFS",
      });
      assert.strictEqual(stops.find((stop) => stop.id === "8500000")?.operator, "AutoPostale");
      // An unknown company as coded, none when missing
      const monteBre = stops.find((stop) => stop.id === "8575302");
      assert.strictEqual(monteBre?.icon, "cableway");
      assert.strictEqual(monteBre?.operator, "XYZ");
      assert.isFalse("operator" in (stops.find((stop) => stop.id === "8575303") ?? {}));
      assert.strictEqual(`${requested[0].origin}${requested[0].pathname}`, IDENTIFY_URL);
      assert.strictEqual(requested[0].searchParams.get("layers"), "all:ch.bav.haltestellen-oev");
    }).pipe(Effect.provide(swisstopo(identify, requested)));
  });
});
