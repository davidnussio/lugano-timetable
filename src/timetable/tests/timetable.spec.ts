import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { InTimeStatus, type Itinerary } from "../models";
import { type Monitor, RtpiClient } from "../rtpi-client";
import { SessionStore } from "../session-store";
import { Timetable } from "../timetable";

const itinerary = (RouteCode: string): Itinerary => ({
  Target: "486",
  Route: RouteCode,
  RouteCode,
  Dir: "1",
  Routing: `R${RouteCode}`,
  Dest: "Lugano",
  Img: `${RouteCode}.jpg`,
  Time: "12:00",
  Pred: InTimeStatus.OnTime,
});

const notReady = (source: string): Monitor<Itinerary> => ({
  source,
  ready: false,
  data: [],
});

interface Calls {
  readonly sources: Array<string>;
  fullTargets: number;
}

const makeCalls = (): Calls => ({ sources: [], fullTargets: 0 });

// RtpiClient answering itinerary requests with `responses` in order (the last
// one is repeated), recording the session sent with each request.
const scriptedRtpi = (
  responses: ReadonlyArray<Monitor<Itinerary>>,
  calls: Calls
) =>
  Layer.succeed(
    RtpiClient,
    RtpiClient.of({
      fullTargets: Effect.sync(() => {
        calls.fullTargets++;
        return [
          {
            Name: "Al Bosco",
            Label: "Albonago, al Bosco",
            Identifiers: [{ Id: "631", Code: "425101" }],
          },
          {
            Name: "Ai Frati",
            Label: "Lugano, ai Frati",
            Identifiers: [
              { Id: "486", Code: "402801" },
              { Id: "487", Code: "402802" },
            ],
          },
        ];
      }),
      itineraries: (source) =>
        Effect.sync(() => {
          calls.sources.push(source);
          return responses[Math.min(calls.sources.length, responses.length) - 1];
        }),
      routing: () => Effect.die("not used"),
    })
  );

const timetable = (
  responses: ReadonlyArray<Monitor<Itinerary>>,
  calls: Calls
) =>
  Timetable.layerNoDeps.pipe(
    Layer.provideMerge(SessionStore.layerMemory),
    Layer.provide(scriptedRtpi(responses, calls))
  );

describe("Timetable", () => {
  it.effect("polls a new session until the server has data", () => {
    const calls = makeCalls();
    const ready: Monitor<Itinerary> = {
      source: "S1",
      ready: true,
      data: [itinerary("12"), itinerary("Funi"), itinerary("2")],
    };

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Timetable.use((t) => t.itineraries([486, 487]))
      );
      yield* TestClock.adjust("1 second");
      const result = yield* Fiber.join(fiber);

      assert.isTrue(result.ready);
      assert.deepStrictEqual(
        result.data.map((i) => i.RouteCode),
        ["2", "12", "Funi"]
      );
      assert.deepStrictEqual(calls.sources, ["", "S1", "S1"]);

      const stored = yield* SessionStore.use((s) =>
        s.get("rtpi:session:GETITINERARIES:486,487")
      );
      assert.deepStrictEqual(stored, Option.some("S1"));
    }).pipe(
      Effect.provide(timetable([notReady("S1"), notReady("S1"), ready], calls))
    );
  });

  it.effect("reuses the stored session for the same stops", () => {
    const calls = makeCalls();

    return Effect.gen(function* () {
      yield* SessionStore.use((s) =>
        s.set("rtpi:session:GETITINERARIES:486,487", "WARM")
      );
      const result = yield* Timetable.use((t) => t.itineraries([486, 487]));

      assert.isTrue(result.ready);
      assert.deepStrictEqual(calls.sources, ["WARM"]);
    }).pipe(
      Effect.provide(timetable([{ source: "WARM", ready: true, data: [] }], calls))
    );
  });

  it.effect("reports not ready when the server keeps answering KO", () => {
    const calls = makeCalls();

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Timetable.use((t) => t.itineraries([486]))
      );
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      assert.deepStrictEqual(result, { ready: false, data: [] });
      assert.strictEqual(calls.sources.length, 9);
    }).pipe(Effect.provide(timetable([notReady("S1")], calls)));
  });

  it.effect("maps, sorts and caches the stop list", () => {
    const calls = makeCalls();

    return Effect.gen(function* () {
      const timetable = yield* Timetable;
      const first = yield* timetable.targets;
      yield* timetable.targets;

      assert.deepStrictEqual(first, [
        {
          Name: "Ai Frati",
          Label: "Lugano, ai Frati",
          Identifiers: ["486", "487"],
        },
        {
          Name: "Al Bosco",
          Label: "Albonago, al Bosco",
          Identifiers: ["631"],
        },
      ]);
      assert.strictEqual(calls.fullTargets, 1);
    }).pipe(Effect.provide(timetable([], calls)));
  });
});

describe("SessionStore.layerMemory", () => {
  it.effect("expires sessions after five minutes", () =>
    Effect.gen(function* () {
      const store = yield* SessionStore;
      yield* store.set("key", "S1");
      yield* TestClock.adjust("4 minutes");
      assert.deepStrictEqual(yield* store.get("key"), Option.some("S1"));
      yield* TestClock.adjust("1 minute");
      assert.deepStrictEqual(yield* store.get("key"), Option.none());
    }).pipe(Effect.provide(SessionStore.layerMemory))
  );
});
