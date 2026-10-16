import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { type Departure, InTimeStatus } from "../models";
import { DelayStore, Reliability } from "../reliability-store";

const departure = (DepartureAt: number): Departure => ({
  Target: "486",
  Route: "12",
  RouteCode: "2",
  Dir: "1",
  Routing: "77",
  Dest: "Lugano",
  Img: "2.jpg",
  Time: "07:42",
  Pred: InTimeStatus.OnTime,
  DepartureAt,
});

// Friday 16 October 2026, 07:41 in Lugano
const NOW = Date.parse("2026-10-16T05:41:00Z");
const KEY = { target: "486", route: "12", dir: "1", time: "07:42" };

// Counts the writes to a memory store
const reliability = (writes: Array<number>) =>
  Reliability.layerNoDeps.pipe(
    Layer.provideMerge(
      Layer.effect(
        DelayStore,
        Effect.map(DelayStore, (store) =>
          DelayStore.of({
            get: store.get,
            add: (key, sample) =>
              Effect.andThen(
                Effect.sync(() => writes.push(sample.delay)),
                store.add(key, sample)
              ),
          })
        )
      ).pipe(Layer.provide(DelayStore.layerMemory))
    )
  );

describe("Reliability", () => {
  it.effect("records the latest delay of the day, once in a while", () => {
    const writes: Array<number> = [];

    return Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const service = yield* Reliability;
      // 40 s late, then 50 s: the second is too soon to be written
      yield* service.record([departure(NOW + 100_000)]);
      yield* TestClock.adjust("10 seconds");
      yield* service.record([departure(NOW + 110_000)]);
      assert.deepStrictEqual(writes, [40]);

      yield* TestClock.adjust("30 seconds");
      yield* service.record([departure(NOW + 110_000)]);
      assert.deepStrictEqual(writes, [40, 50]);

      const stored = yield* DelayStore.use((store) => store.get("2026:weekday:486:12:1:07:42"));
      assert.deepStrictEqual(stored, [{ date: "2026-10-16", delay: 50 }]);
    }).pipe(Effect.provide(reliability(writes)));
  });

  it.effect("summarizes the past days of the same type", () => {
    const writes: Array<number> = [];

    return Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      yield* DelayStore.use((store) =>
        Effect.forEach([0, 60, 120, 180, 240], (delay, day) =>
          store.add("2026:weekday:486:12:1:07:42", { date: `2026-10-0${day + 5}`, delay })
        )
      );
      yield* DelayStore.use((store) =>
        store.add("2026:saturday:486:12:1:07:42", { date: "2026-10-10", delay: 600 })
      );

      const stats = yield* Reliability.use((service) => service.stats(KEY));
      assert.deepStrictEqual(stats, {
        samples: 5,
        median: 120,
        p80: 180,
        lateShare: 0.4,
      });
    }).pipe(Effect.provide(reliability(writes)));
  });

  it.effect("has no figures for a departure never seen", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const stats = yield* Reliability.use((service) => service.stats(KEY));
      assert.deepStrictEqual(stats, { samples: 0 });
    }).pipe(Effect.provide(reliability([])))
  );
});
