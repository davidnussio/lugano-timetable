import type { Redis } from "@upstash/redis";
import { Clock, Context, Duration, Effect, Layer, Option } from "effect";
import { upstashRedis } from "./redis";

const SESSION_TTL = Duration.minutes(5);

// Stores RTPI session ids so that every request (and every serverless
// instance, when Redis is configured) reuses the same warm session for the
// same query. A session expires five minutes after its last use: reading it
// extends it, so that it is written only when the server opens a new one.
// Storage failures are logged and treated as a missing session: the worst
// case is opening a new one.
export class SessionStore extends Context.Service<
  SessionStore,
  {
    get(key: string): Effect.Effect<Option.Option<string>>;
    set(key: string, source: string): Effect.Effect<void>;
  }
>()("lugano-timetable/timetable/SessionStore") {
  static readonly layerMemory = Layer.sync(SessionStore, () => {
    const entries = new Map<string, { source: string; expiresAt: number }>();

    return SessionStore.of({
      get: (key) =>
        Effect.map(Clock.currentTimeMillis, (now) => {
          const entry = entries.get(key);
          if (entry === undefined || entry.expiresAt <= now) {
            entries.delete(key);
            return Option.none();
          }
          entry.expiresAt = now + Duration.toMillis(SESSION_TTL);
          return Option.some(entry.source);
        }),
      set: (key, source) =>
        Effect.map(Clock.currentTimeMillis, (now) => {
          entries.set(key, {
            source,
            expiresAt: now + Duration.toMillis(SESSION_TTL),
          });
        }),
    });
  });

  static readonly layerRedis = (redis: Redis) =>
    Layer.succeed(
      SessionStore,
      SessionStore.of({
        get: (key) =>
          Effect.tryPromise(() =>
            redis.getex<string>(key, { ex: Duration.toSeconds(SESSION_TTL) })
          ).pipe(
            Effect.map(Option.fromNullishOr),
            Effect.catch((error) =>
              Effect.as(
                Effect.logWarning("Failed to read RTPI session", error),
                Option.none()
              )
            )
          ),
        set: (key, source) =>
          Effect.tryPromise(() =>
            redis.set(key, source, { ex: Duration.toSeconds(SESSION_TTL) })
          ).pipe(
            Effect.asVoid,
            Effect.catch((error) =>
              Effect.logWarning("Failed to store RTPI session", error)
            )
          ),
      })
    );

  // Uses Upstash Redis when configured, memory otherwise
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const redis = yield* upstashRedis;

      if (Option.isNone(redis)) {
        yield* Effect.logWarning(
          "Redis is not configured, using in-memory RTPI sessions"
        );
        return SessionStore.layerMemory;
      }

      return SessionStore.layerRedis(redis.value);
    })
  );
}
