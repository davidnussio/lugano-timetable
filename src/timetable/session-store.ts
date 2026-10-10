import { Redis } from "@upstash/redis";
import {
  Clock,
  Config,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
} from "effect";

const SESSION_TTL = Duration.minutes(5);

// Stores RTPI session ids so that every request (and every serverless
// instance, when Redis is configured) reuses the same warm session for the
// same query. Storage failures are logged and treated as a missing session:
// the worst case is opening a new one.
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
          Effect.tryPromise(() => redis.get<string>(key)).pipe(
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

  // Uses Upstash Redis (Vercel Marketplace variables included) when
  // configured, memory otherwise (e.g. local development).
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

      if (Option.isNone(redis)) {
        yield* Effect.logWarning(
          "Redis is not configured, using in-memory RTPI sessions"
        );
        return SessionStore.layerMemory;
      }

      return SessionStore.layerRedis(
        new Redis({
          url: redis.value.url,
          token: Redacted.value(redis.value.token),
        })
      );
    })
  );
}
