import type { Redis } from "@upstash/redis";
import { Clock, Context, Duration, Effect, Layer, Option } from "effect";
import type { Departure } from "./models";
import { upstashRedis } from "./redis";
import {
  addSample,
  type DelaySample,
  type DelayStats,
  delayKey,
  delayStats,
  type DepartureKey,
  isDelaySample,
  observeDelay,
  recentSamples,
  serviceDay,
  WINDOW_DAYS,
} from "./reliability";

// A departure unused for this long has no sample left in the window
const SAMPLES_TTL = Duration.days(WINDOW_DAYS);
// Every phone on a stop polls every few seconds: one write per departure in
// this time is enough for the latest estimate to win
const RECORD_EVERY_MS = 30_000;

// The delays seen for each departure, one per day. Storage failures are
// logged and treated as no samples: the worst case is a day not counted.
export class DelayStore extends Context.Service<
  DelayStore,
  {
    get(key: string): Effect.Effect<ReadonlyArray<DelaySample>>;
    add(key: string, sample: DelaySample): Effect.Effect<void>;
  }
>()("lugano-timetable/timetable/DelayStore") {
  static readonly layerMemory = Layer.sync(DelayStore, () => {
    const entries = new Map<string, ReadonlyArray<DelaySample>>();

    return DelayStore.of({
      get: (key) => Effect.sync(() => entries.get(key) ?? []),
      add: (key, sample) =>
        Effect.sync(() => {
          entries.set(key, addSample(entries.get(key) ?? [], sample));
        }),
    });
  });

  static readonly layerRedis = (redis: Redis) => {
    const get = (key: string) =>
      Effect.tryPromise(() => redis.get<unknown>(`reliability:${key}`)).pipe(
        // Values written by an older version, or corrupted, are dropped
        Effect.map((value) =>
          Array.isArray(value) ? value.filter(isDelaySample) : []
        )
      );

    return Layer.succeed(
      DelayStore,
      DelayStore.of({
        get: (key) =>
          get(key).pipe(
            Effect.catch((error) =>
              Effect.as(Effect.logWarning("Failed to read delays", error), [])
            )
          ),
        // Two instances writing the same departure at once lose one of the
        // two estimates, of the same day: the next poll writes it again
        add: (key, sample) =>
          get(key).pipe(
            Effect.flatMap((samples) =>
              Effect.tryPromise(() =>
                redis.set(`reliability:${key}`, addSample(samples, sample), {
                  ex: Duration.toSeconds(SAMPLES_TTL),
                })
              )
            ),
            Effect.asVoid,
            Effect.catch((error) =>
              Effect.logWarning("Failed to store delay", error)
            )
          ),
      })
    );
  };

  // Uses Upstash Redis when configured, memory otherwise
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const redis = yield* upstashRedis;

      if (Option.isNone(redis)) {
        yield* Effect.logWarning(
          "Redis is not configured, using in-memory delays"
        );
        return DelayStore.layerMemory;
      }

      return DelayStore.layerRedis(redis.value);
    })
  );
}

// How late the departures usually leave, learned from the real-time data
// served to the stop pages and the timers
export class Reliability extends Context.Service<
  Reliability,
  {
    // Keeps the delay of the departures about to leave. Never fails: meant
    // to run detached from the response.
    record(departures: ReadonlyArray<Departure>): Effect.Effect<void>;
    stats(departure: DepartureKey): Effect.Effect<DelayStats>;
  }
>()("lugano-timetable/timetable/Reliability") {
  static readonly layerNoDeps = Layer.effect(
    Reliability,
    Effect.gen(function* () {
      const store = yield* DelayStore;
      // When this instance last wrote each departure
      const written = new Map<string, number>();

      return Reliability.of({
        record: Effect.fn("Reliability.record")(function* (departures) {
          const now = yield* Clock.currentTimeMillis;
          for (const [key, at] of written) {
            if (now - at >= RECORD_EVERY_MS) written.delete(key);
          }
          const observations = departures.flatMap((departure) => {
            const observation = observeDelay(departure, now);
            if (observation === undefined || written.has(observation.key)) {
              return [];
            }
            written.set(observation.key, now);
            return [observation];
          });
          yield* Effect.forEach(
            observations,
            ({ key, sample }) => store.add(key, sample),
            { concurrency: 4, discard: true }
          );
        }),
        stats: Effect.fn("Reliability.stats")(function* (departure) {
          const now = yield* Clock.currentTimeMillis;
          const day = serviceDay(departure.time, now);
          if (day === undefined) return { samples: 0 };
          const samples = yield* store.get(delayKey(departure, day.dayType));
          return delayStats(recentSamples(samples, day.date));
        }),
      });
    })
  );

  static readonly layer = Reliability.layerNoDeps.pipe(
    Layer.provide(DelayStore.layer)
  );
}
