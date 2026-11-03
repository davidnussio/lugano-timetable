import type { Redis } from "@upstash/redis";
import { Array as Arr, Clock, Context, Duration, Effect, Layer, Option } from "effect";
import {
  isLineSeed,
  type Line,
  type LineSeed,
  linesOf,
  type SeenSeed,
  seedKey,
  seedsOf,
} from "./lines";
import type { Itinerary } from "./models";
import { upstashRedis } from "./redis";
import { Timetable } from "./timetable";

// A line not seen for this long no longer runs (or changed its routing)
const SEED_MAX_AGE = Duration.days(14);
// Every phone on a stop polls every few seconds: a routing written once in
// this time per instance is enough
const RECORD_EVERY_MS = 10 * 60_000;
// Below this many lines the catalog is still being learned: the stops are
// all asked for their departures, at most once in this time
const KNOWN_LINES = 10;
const SCAN_EVERY = Duration.hours(6);
// Platforms asked at once while scanning, and requests at the same time
const SCAN_CHUNK = 40;
const SCAN_CONCURRENCY = 2;

interface StoredSeed {
  readonly seed: LineSeed;
  readonly seenAt: number;
}

const isStoredSeed = (value: unknown): value is StoredSeed =>
  typeof value === "object" &&
  value !== null &&
  isLineSeed((value as StoredSeed).seed) &&
  typeof (value as StoredSeed).seenAt === "number";

// Values come back parsed by the Redis client, or as text
const parseStored = (value: unknown): StoredSeed | undefined => {
  if (typeof value === "string") {
    try {
      return parseStored(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return isStoredSeed(value) ? value : undefined;
};

// The routings seen, with how many times. Storage failures are logged and
// treated as nothing seen: the catalog is learned again.
export class LineStore extends Context.Service<
  LineStore,
  {
    all: Effect.Effect<ReadonlyArray<SeenSeed & { readonly seenAt: number }>>;
    add(seeds: ReadonlyArray<LineSeed>, now: number): Effect.Effect<void>;
    // Whether a scan of the stops may start now, taking the turn
    claimScan(now: number): Effect.Effect<boolean>;
  }
>()("lugano-timetable/timetable/LineStore") {
  static readonly layerMemory = Layer.sync(LineStore, () => {
    const seeds = new Map<string, StoredSeed & { hits: number }>();
    let scannedAt = Number.NEGATIVE_INFINITY;

    return LineStore.of({
      all: Effect.sync(() => [...seeds.values()]),
      add: (added, now) =>
        Effect.sync(() => {
          for (const seed of added) {
            const hits = (seeds.get(seedKey(seed))?.hits ?? 0) + 1;
            seeds.set(seedKey(seed), { seed, seenAt: now, hits });
          }
        }),
      claimScan: (now) =>
        Effect.sync(() => {
          if (now - scannedAt < Duration.toMillis(SCAN_EVERY)) return false;
          scannedAt = now;
          return true;
        }),
    });
  });

  static readonly layerRedis = (redis: Redis) => {
    const ttl = Duration.toSeconds(SEED_MAX_AGE);
    return Layer.succeed(
      LineStore,
      LineStore.of({
        all: Effect.tryPromise(() =>
          Promise.all([
            redis.hgetall<Record<string, unknown>>("lines:seeds"),
            redis.hgetall<Record<string, unknown>>("lines:hits"),
          ])
        ).pipe(
          Effect.map(([stored, hits]) =>
            Object.entries(stored ?? {}).flatMap(([key, value]) => {
              const entry = parseStored(value);
              return entry ? [{ ...entry, hits: Number(hits?.[key]) || 1 }] : [];
            })
          ),
          Effect.catch((error) =>
            Effect.as(Effect.logWarning("Failed to read the lines", error), [])
          )
        ),
        add: (added, now) =>
          added.length === 0
            ? Effect.void
            : Effect.tryPromise(() => {
                const pipeline = redis.pipeline();
                pipeline.hset(
                  "lines:seeds",
                  Object.fromEntries(
                    added.map((seed) => [seedKey(seed), JSON.stringify({ seed, seenAt: now })])
                  )
                );
                for (const seed of added) pipeline.hincrby("lines:hits", seedKey(seed), 1);
                pipeline.expire("lines:seeds", ttl);
                pipeline.expire("lines:hits", ttl);
                return pipeline.exec();
              }).pipe(
                Effect.asVoid,
                Effect.catch((error) => Effect.logWarning("Failed to store the lines", error))
              ),
        claimScan: () =>
          Effect.tryPromise(() =>
            redis.set("lines:scan", "1", { nx: true, ex: Duration.toSeconds(SCAN_EVERY) })
          ).pipe(
            Effect.map((result) => result === "OK"),
            Effect.catch((error) =>
              Effect.as(Effect.logWarning("Failed to claim the scan of the lines", error), false)
            )
          ),
      })
    );
  };

  // Uses Upstash Redis when configured, memory otherwise
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const redis = yield* upstashRedis;
      return Option.isNone(redis) ? LineStore.layerMemory : LineStore.layerRedis(redis.value);
    })
  );
}

// The lines of TPL, learned from the departures (see `lines.ts`)
export class Lines extends Context.Service<
  Lines,
  {
    // Keeps the routings of the departures. Never fails: meant to run
    // detached from the response.
    record(departures: ReadonlyArray<Itinerary>): Effect.Effect<void>;
    // The lines known, starting a scan of the stops while they are few
    readonly lines: Effect.Effect<ReadonlyArray<Line>>;
  }
>()("lugano-timetable/timetable/Lines") {
  static readonly layerNoDeps = Layer.effect(
    Lines,
    Effect.gen(function* () {
      const store = yield* LineStore;
      const timetable = yield* Timetable;
      // When this instance last wrote each routing
      const written = new Map<string, number>();

      const record = Effect.fn("Lines.record")(function* (
        departures: ReadonlyArray<Itinerary>
      ) {
        const now = yield* Clock.currentTimeMillis;
        for (const [key, at] of written) {
          if (now - at >= RECORD_EVERY_MS) written.delete(key);
        }
        const fresh = seedsOf(departures).filter((seed) => !written.has(seedKey(seed)));
        for (const seed of fresh) written.set(seedKey(seed), now);
        yield* store.add(fresh, now);
      });

      // Every platform asked for its departures, a few at a time
      const scan = Effect.gen(function* () {
        const targets = yield* timetable.targets;
        const platforms = targets.flatMap((target) =>
          target.Identifiers.map(Number).filter(Number.isInteger)
        );
        yield* Effect.forEach(
          Arr.chunksOf(platforms, SCAN_CHUNK),
          (chunk) =>
            timetable.itineraries(chunk).pipe(
              Effect.flatMap((result) => record(result.data)),
              Effect.catch((error) =>
                Effect.logWarning("Failed to scan stops for their lines", error)
              )
            ),
          { concurrency: SCAN_CONCURRENCY, discard: true }
        );
      }).pipe(
        Effect.catch((error) => Effect.logWarning("Failed to scan the lines", error)),
        Effect.withSpan("Lines.scan")
      );

      const lines = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const seen = (yield* store.all).filter(
          (entry) => now - entry.seenAt < Duration.toMillis(SEED_MAX_AGE)
        );
        const known = linesOf(seen);
        if (known.length < KNOWN_LINES && (yield* store.claimScan(now))) {
          yield* Effect.forkDetach(scan);
        }
        return known;
      }).pipe(Effect.withSpan("Lines.lines"));

      return Lines.of({ record, lines });
    })
  );

  static readonly layer = Lines.layerNoDeps.pipe(Layer.provide(LineStore.layer));
}
