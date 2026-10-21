import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  Config,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import type { RoutineState } from "./schedule";
import { RoutineState as RoutineStateSchema, Subscriber } from "./schema";

// The usual journeys of every device, and what was sent for them. Without
// Redis there is nowhere to keep them between the ticks: the feature is off
// and every call fails with RoutinesUnavailable (503).

export class RoutinesUnavailable extends Schema.TaggedError<RoutinesUnavailable>()(
  "RoutinesUnavailable",
  {
    // What is not configured: "redis", "vapid"
    missing: Schema.String,
  }
) {}

export class RoutineStoreError extends Schema.TaggedError<RoutineStoreError>()(
  "RoutineStoreError",
  {
    cause: Schema.Defect(),
  }
) {}

type StoreError = RoutineStoreError | RoutinesUnavailable;

// The subscriptions are keyed by a hash of their endpoint, a secret URL of
// the push service that is better not spread around in key names
export function subscriberKey(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("base64url").slice(0, 22);
}

// What was sent for a routine on a day (of the arrival, in Lugano)
export interface StateKey {
  readonly subscriber: string;
  readonly routine: string;
  readonly date: string;
}

const SUBSCRIBERS = "routines:subscribers";
const stateKey = ({ subscriber, routine, date }: StateKey) =>
  `routines:state:${subscriber}:${routine}:${date}`;
const lockKey = (subscriber: string, routine: string) =>
  `routines:lock:${subscriber}:${routine}`;

// Long enough for a trip just after midnight, gone by the next week
const STATE_TTL = Duration.days(2);
// Longer than a tick, in case one dies without releasing it
const LOCK_TTL = Duration.seconds(55);

const decodeSubscriber = Schema.decodeUnknownOption(Subscriber);
const decodeState = Schema.decodeUnknownOption(RoutineStateSchema);

// Upstash parses the JSON values it reads: accept both forms
const json = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export class RoutineStore extends Context.Service<
  RoutineStore,
  {
    // Fails when the feature is off
    readonly available: Effect.Effect<void, RoutinesUnavailable>;
    // Replaces the routines of a device: none forgets it
    save(subscriber: Subscriber): Effect.Effect<void, StoreError>;
    remove(key: string): Effect.Effect<void, StoreError>;
    subscribers(): Effect.Effect<ReadonlyArray<Subscriber>, StoreError>;
    states(
      keys: ReadonlyArray<StateKey>
    ): Effect.Effect<ReadonlyArray<RoutineState | undefined>, StoreError>;
    setState(key: StateKey, state: RoutineState): Effect.Effect<void, StoreError>;
    // A routine handled by one tick at a time: false when another has it
    lock(subscriber: string, routine: string): Effect.Effect<boolean, StoreError>;
    unlock(subscriber: string, routine: string): Effect.Effect<void>;
  }
>()("lugano-timetable/routines/RoutineStore") {
  static readonly layerUnavailable = Layer.succeed(
    RoutineStore,
    (() => {
      const unavailable = Effect.fail(new RoutinesUnavailable({ missing: "redis" }));
      return RoutineStore.of({
        available: unavailable,
        save: () => unavailable,
        remove: () => unavailable,
        subscribers: () => unavailable,
        states: () => unavailable,
        setState: () => unavailable,
        lock: () => unavailable,
        unlock: () => Effect.void,
      });
    })()
  );

  // For the tests: no expiry
  static readonly layerMemory = Layer.sync(RoutineStore, () => {
    const subscribers = new Map<string, Subscriber>();
    const states = new Map<string, RoutineState>();
    const locks = new Set<string>();

    return RoutineStore.of({
      available: Effect.void,
      save: (subscriber) =>
        Effect.sync(() => {
          if (subscriber.routines.length === 0) subscribers.delete(subscriber.key);
          else subscribers.set(subscriber.key, subscriber);
        }),
      remove: (key) => Effect.sync(() => void subscribers.delete(key)),
      subscribers: () => Effect.sync(() => [...subscribers.values()]),
      states: (keys) => Effect.sync(() => keys.map((key) => states.get(stateKey(key)))),
      setState: (key, state) => Effect.sync(() => void states.set(stateKey(key), state)),
      lock: (subscriber, routine) =>
        Effect.sync(() => {
          const key = lockKey(subscriber, routine);
          if (locks.has(key)) return false;
          locks.add(key);
          return true;
        }),
      unlock: (subscriber, routine) =>
        Effect.sync(() => void locks.delete(lockKey(subscriber, routine))),
    });
  });

  static readonly layerRedis = (redis: Redis) => {
    const call = <A>(operation: string, run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: (cause) => new RoutineStoreError({ cause }),
      }).pipe(Effect.withSpan(`RoutineStore.${operation}`));

    return Layer.succeed(
      RoutineStore,
      RoutineStore.of({
        available: Effect.void,
        save: (subscriber) =>
          subscriber.routines.length === 0
            ? Effect.asVoid(call("save", () => redis.hdel(SUBSCRIBERS, subscriber.key)))
            : Effect.asVoid(
                call("save", () =>
                  redis.hset(SUBSCRIBERS, { [subscriber.key]: JSON.stringify(subscriber) })
                )
              ),
        remove: (key) => Effect.asVoid(call("remove", () => redis.hdel(SUBSCRIBERS, key))),
        subscribers: () =>
          call("subscribers", () => redis.hgetall<Record<string, unknown>>(SUBSCRIBERS)).pipe(
            Effect.map((entries) =>
              Object.values(entries ?? {}).flatMap((value) =>
                Option.toArray(decodeSubscriber(json(value)))
              )
            )
          ),
        states: (keys) =>
          keys.length === 0
            ? Effect.succeed([])
            : call("states", () => redis.mget<Array<unknown>>(keys.map(stateKey))).pipe(
                Effect.map((values) =>
                  values.map((value) => Option.getOrUndefined(decodeState(json(value))))
                )
              ),
        setState: (key, state) =>
          Effect.asVoid(
            call("setState", () =>
              redis.set(stateKey(key), JSON.stringify(state), {
                ex: Duration.toSeconds(STATE_TTL),
              })
            )
          ),
        lock: (subscriber, routine) =>
          call("lock", () =>
            redis.set(lockKey(subscriber, routine), "1", {
              nx: true,
              px: Duration.toMillis(LOCK_TTL),
            })
          ).pipe(Effect.map((result) => result === "OK")),
        unlock: (subscriber, routine) =>
          call("unlock", () => redis.del(lockKey(subscriber, routine))).pipe(
            Effect.asVoid,
            Effect.catch((error) => Effect.logWarning("Failed to release a routine", error))
          ),
      })
    );
  };

  // Upstash Redis (Vercel Marketplace variables included), as for the RTPI
  // sessions
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const redis = yield* Config.all({
        url: Config.String("UPSTASH_REDIS_REST_URL").pipe(
          Config.orElse(() => Config.String("KV_REST_API_URL"))
        ),
        token: Config.Redacted("UPSTASH_REDIS_REST_TOKEN").pipe(
          Config.orElse(() => Config.Redacted("KV_REST_API_TOKEN"))
        ),
      }).pipe(Config.option);

      if (Option.isNone(redis)) return RoutineStore.layerUnavailable;

      return RoutineStore.layerRedis(
        new Redis({
          url: redis.value.url,
          token: Redacted.value(redis.value.token),
        })
      );
    })
  );
}
