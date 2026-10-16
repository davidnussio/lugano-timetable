import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { OPENDATA_URL, Opendata } from "../opendata-client";
import { connection, locations, stationboard } from "./fixtures";

// HttpClient answering with `respond(url)`, recording the requested URLs
const fakeHttp = (respond: (url: URL) => Response, requested: Array<URL>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requested.push(url);
      return Effect.succeed(HttpClientResponse.fromWeb(request, respond(url)));
    })
  );

const opendata = (
  respond: (url: URL) => Response,
  requested: Array<URL> = []
) => Opendata.layerNoDeps.pipe(Layer.provide(fakeHttp(respond, requested)));

const json = (body: unknown) => () => Response.json(body);

describe("Opendata", () => {
  it.effect("searches stops by name, dropping addresses", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Opendata;
      const stations = yield* client.stations({ query: "lugano" });
      assert.deepStrictEqual(
        stations.map((station) => station.id),
        ["8591603", "8505550"]
      );
      assert.strictEqual(requested[0].href, `${OPENDATA_URL}/locations?query=lugano&type=station`);
    }).pipe(Effect.provide(opendata(json(locations), requested)));
  });

  it.effect("searches stops near a position", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Opendata;
      yield* client.stations({ lat: 46.0049, lon: 8.9515 });
      assert.strictEqual(requested[0].searchParams.get("x"), "46.0049");
      assert.strictEqual(requested[0].searchParams.get("y"), "8.9515");
    }).pipe(Effect.provide(opendata(json(locations), requested)));
  });

  it.effect("plans connections from a given time", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Opendata;
      const connections = yield* client.connections(
        "8591577",
        "8505213",
        Date.UTC(2026, 9, 11, 17, 28)
      );
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].legs.length, 2);
      const params = requested[0].searchParams;
      assert.strictEqual(params.get("from"), "8591577");
      assert.strictEqual(params.get("to"), "8505213");
      assert.strictEqual(params.get("datetime"), "2026-10-11 19:28");
    }).pipe(
      Effect.provide(opendata(json({ connections: [connection] }), requested))
    );
  });

  it.effect("plans connections arriving by a given time", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Opendata;
      yield* client.connections("8591577", "8505213", Date.UTC(2026, 9, 12, 5, 55), {
        arrival: true,
      });
      const params = requested[0].searchParams;
      assert.strictEqual(params.get("datetime"), "2026-10-12 07:55");
      assert.strictEqual(params.get("isArrivalTime"), "1");
      // Departures by default, as before
      yield* client.connections("8591577", "8505213", Date.UTC(2026, 9, 12, 5, 55));
      assert.isNull(requested[1].searchParams.get("isArrivalTime"));
    }).pipe(
      Effect.provide(opendata(json({ connections: [connection] }), requested))
    );
  });

  it.effect("refreshes legs from the departures of their stop", () => {
    const requested: Array<URL> = [];
    return Effect.gen(function* () {
      const client = yield* Opendata;
      const updates = yield* client.legs([
        { from: "8591653", trip: "003376", at: 1791742740000, to: "8575286" },
        { from: "8591653", trip: "009999", at: 1791742740000, to: "8575286" },
      ]);
      assert.strictEqual(updates[0]?.arrival.estimated, 1791743520000);
      assert.isNull(updates[1]);
      assert.strictEqual(requested[0].searchParams.get("id"), "8591653");
      assert.strictEqual(requested[0].searchParams.get("datetime"), "2026-10-11 20:19");
    }).pipe(Effect.provide(opendata(json(stationboard), requested)));
  });

  // Real clock: the 504 is retried once after a short pause
  it.live("keeps the other legs when a stop fails", () =>
    Effect.gen(function* () {
      const client = yield* Opendata;
      const updates = yield* client.legs([
        { from: "8591653", trip: "003376", at: 1791742740000, to: "8575286" },
      ]);
      assert.deepStrictEqual(updates, [null]);
    }).pipe(
      Effect.provide(
        opendata(() => new Response("Gateway Time-out", { status: 504 }))
      )
    )
  );

  it.effect("fails with OpendataError on errors", () =>
    Effect.gen(function* () {
      const client = yield* Opendata;
      const error = yield* Effect.flip(client.connections("8591577", "8505213"));
      assert.strictEqual(error._tag, "OpendataError");
      assert.strictEqual(error.endpoint, "connections");
    }).pipe(Effect.provide(opendata(json({ error: "nope" }))))
  );
});
