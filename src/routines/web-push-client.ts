import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import webpush from "web-push";
import type { PushMessage } from "./models";
import type { PushSubscriptionJson } from "./schema";
import { RoutinesUnavailable } from "./store";

// Sends Web Push messages through the push service of each browser (FCM,
// Mozilla, Apple), signed with the VAPID keys of the app. The messages reach
// the service worker even with the app closed.

export class PushError extends Schema.TaggedError<PushError>()("PushError", {
  // HTTP status of the push service, when it answered
  status: Schema.optionalKey(Schema.Number),
  cause: Schema.Defect(),
}) {}

export interface PushOptions {
  // After this the message is useless: dropped if the phone is offline
  readonly ttlSeconds: number;
  // A message still waiting with the same topic is replaced
  readonly topic: string;
}

export class WebPush extends Context.Service<
  WebPush,
  {
    // Fails when the VAPID keys are not configured
    readonly available: Effect.Effect<void, RoutinesUnavailable>;
    // "gone" when the browser dropped the subscription: forget it
    send(
      subscription: PushSubscriptionJson,
      message: PushMessage,
      options: PushOptions
    ): Effect.Effect<"sent" | "gone", PushError | RoutinesUnavailable>;
  }
>()("lugano-timetable/routines/WebPush") {
  static readonly layerUnavailable = Layer.succeed(
    WebPush,
    WebPush.of({
      available: Effect.fail(new RoutinesUnavailable({ missing: "vapid" })),
      send: () => Effect.fail(new RoutinesUnavailable({ missing: "vapid" })),
    })
  );

  static readonly make = (vapid: {
    readonly subject: string;
    readonly publicKey: string;
    readonly privateKey: Redacted.Redacted<string>;
  }) =>
    Layer.succeed(
      WebPush,
      WebPush.of({
        available: Effect.void,
        send: (subscription, message, { ttlSeconds, topic }) =>
          Effect.tryPromise({
            try: () =>
              webpush.sendNotification(
                { ...subscription, keys: { ...subscription.keys } },
                JSON.stringify(message),
                {
                  vapidDetails: {
                    subject: vapid.subject,
                    publicKey: vapid.publicKey,
                    privateKey: Redacted.value(vapid.privateKey),
                  },
                  TTL: ttlSeconds,
                  topic,
                  // Shown at once, also on a phone saving battery
                  urgency: "high",
                  timeout: 10_000,
                }
              ),
            catch: (cause) => cause,
          }).pipe(
            Effect.as("sent" as const),
            Effect.catch((cause) => {
              const status =
                typeof cause === "object" && cause !== null && "statusCode" in cause
                  ? Number(cause.statusCode)
                  : undefined;
              // The subscription expired or was revoked
              if (status === 404 || status === 410) return Effect.succeed("gone" as const);
              return Effect.fail(
                new PushError({ ...(status === undefined ? {} : { status }), cause })
              );
            }),
            Effect.withSpan("WebPush.send")
          ),
      })
    );

  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const vapid = yield* Config.all({
        subject: Config.String("VAPID_SUBJECT"),
        publicKey: Config.String("VAPID_PUBLIC_KEY"),
        privateKey: Config.Redacted("VAPID_PRIVATE_KEY"),
      }).pipe(Config.option);

      return Option.isNone(vapid) ? WebPush.layerUnavailable : WebPush.make(vapid.value);
    })
  );
}
