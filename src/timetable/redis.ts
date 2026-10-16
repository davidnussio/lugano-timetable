import { Redis } from "@upstash/redis";
import { Config, Effect, Option, Redacted } from "effect";

// Upstash Redis (Vercel Marketplace variables included) when configured,
// none otherwise (e.g. local development)
export const upstashRedis = Effect.gen(function* () {
  const config = yield* Config.all({
    url: Config.String("UPSTASH_REDIS_REST_URL").pipe(
      Config.orElse(() => Config.String("KV_REST_API_URL"))
    ),
    token: Config.Redacted("UPSTASH_REDIS_REST_TOKEN").pipe(
      Config.orElse(() => Config.Redacted("KV_REST_API_TOKEN"))
    ),
  }).pipe(Config.option);

  return Option.map(
    config,
    ({ url, token }) => new Redis({ url, token: Redacted.value(token) })
  );
});
