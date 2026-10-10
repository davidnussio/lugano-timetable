import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { RTPI_URL, RtpiClient, rtpiMessage } from "../rtpi-client";

// HttpClient answering every request with `body`, recording the requested URLs
const fakeHttp = (body: unknown, requested: Array<URL>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requested.push(url);
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, Response.json(body))
      );
    })
  );

const rtpiClient = (body: unknown, requested: Array<URL> = []) =>
  RtpiClient.layerNoDeps.pipe(Layer.provide(fakeHttp(body, requested)));

describe("rtpiMessage", () => {
  it("requests the TPL stops like the official app", () => {
    assert.strictEqual(
      rtpiMessage("GETFULLTARGETS", ""),
      "{basin:'TPL',reqbasin:'TPL',source:'',destination:0,type:GETFULLTARGETS,data:{crc:0}}"
    );
  });

  it("sends session and parameters for monitored requests", () => {
    assert.strictEqual(
      rtpiMessage("GETITINERARIES", "ABC", [486, 487]),
      '{source:"ABC",destination:0,type:GETITINERARIES,data:{parameters:[486,487]}}'
    );
  });
});

describe("RtpiClient", () => {
  it.effect("decodes itineraries keeping only the used fields", () => {
    const requested: Array<URL> = [];
    const body = {
      status: "OK",
      source: "S1",
      validity: "OK",
      data: [
        {
          Target: "486",
          Route: "32",
          RouteCode: "6",
          Dir: "2",
          Routing: "636",
          Dest: "Lugano FFS",
          Img: "32.jpg",
          Time: "11:33",
          Pred: 1,
          Latitude: "46.01",
        },
      ],
    };

    return Effect.gen(function* () {
      const rtpi = yield* RtpiClient;
      const result = yield* rtpi.itineraries("S0", [486, 487]);

      assert.strictEqual(result.source, "S1");
      assert.isTrue(result.ready);
      assert.deepStrictEqual(Object.keys(result.data[0]).sort(), [
        "Dest",
        "Dir",
        "Img",
        "Pred",
        "Route",
        "RouteCode",
        "Routing",
        "Target",
        "Time",
      ]);
      assert.strictEqual(`${requested[0].origin}${requested[0].pathname}`, RTPI_URL);
      assert.strictEqual(
        requested[0].searchParams.get("data"),
        rtpiMessage("GETITINERARIES", "S0", [486, 487])
      );
    }).pipe(Effect.provide(rtpiClient(body, requested)));
  });

  it.effect("reports KO responses as not ready", () =>
    Effect.gen(function* () {
      const rtpi = yield* RtpiClient;
      const result = yield* rtpi.routing("", [486, 20, 2, 586]);
      assert.isFalse(result.ready);
      assert.deepStrictEqual(result.data, []);
    }).pipe(
      Effect.provide(
        rtpiClient({ status: "OK", source: "S1", validity: "KO", data: [] })
      )
    )
  );

  it.effect("fails with RtpiError on unexpected responses", () =>
    Effect.gen(function* () {
      const rtpi = yield* RtpiClient;
      const error = yield* Effect.flip(rtpi.fullTargets);
      assert.strictEqual(error._tag, "RtpiError");
      assert.strictEqual(error.type, "GETFULLTARGETS");
    }).pipe(Effect.provide(rtpiClient({ status: "ERROR", data: [] })))
  );
});
