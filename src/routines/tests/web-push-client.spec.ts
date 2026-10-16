import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import webpush from "web-push";
import { WebPush } from "../web-push-client";

const subscription = {
  endpoint: "https://push.example.com/send/123",
  keys: { p256dh: "p256dh", auth: "auth" },
};
const message = { title: "Esci ora", body: "Il 6 delle 7:37", tag: "routine-abc", url: "/tragitto" };
const options = { ttlSeconds: 300, topic: "abcdef0123456789" };

const layer = WebPush.make({
  subject: "mailto:test@example.com",
  publicKey: "public",
  privateKey: Redacted.make("private"),
});

const rejectWith = (status: number) =>
  vi
    .spyOn(webpush, "sendNotification")
    .mockRejectedValue(new webpush.WebPushError("Push failed", status, {}, "", subscription.endpoint));

describe("WebPush", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("sends the message as JSON, short-lived and urgent", () => {
    const send = vi
      .spyOn(webpush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    return Effect.gen(function* () {
      const push = yield* WebPush;
      assert.strictEqual(yield* push.send(subscription, message, options), "sent");
      const [to, payload, sent] = send.mock.calls[0];
      assert.strictEqual(to.endpoint, subscription.endpoint);
      assert.deepStrictEqual(JSON.parse(String(payload)), message);
      assert.strictEqual(sent?.TTL, 300);
      assert.strictEqual(sent?.topic, options.topic);
      assert.strictEqual(sent?.urgency, "high");
      assert.strictEqual(sent?.vapidDetails?.privateKey, "private");
    }).pipe(Effect.provide(layer));
  });

  it.effect("tells a subscription gone on 404 and 410", () => {
    rejectWith(410);
    return Effect.gen(function* () {
      const push = yield* WebPush;
      assert.strictEqual(yield* push.send(subscription, message, options), "gone");
      rejectWith(404);
      assert.strictEqual(yield* push.send(subscription, message, options), "gone");
    }).pipe(Effect.provide(layer));
  });

  it.effect("fails on the other errors, to try again", () => {
    rejectWith(429);
    return Effect.gen(function* () {
      const push = yield* WebPush;
      const error = yield* Effect.flip(push.send(subscription, message, options));
      assert.strictEqual(error._tag, "PushError");
      assert.strictEqual(error._tag === "PushError" ? error.status : undefined, 429);
    }).pipe(Effect.provide(layer));
  });

  it.effect("is off without the VAPID keys", () =>
    Effect.gen(function* () {
      const push = yield* WebPush;
      const error = yield* Effect.flip(push.available);
      assert.strictEqual(error.missing, "vapid");
    }).pipe(Effect.provide(WebPush.layerUnavailable))
  );
});
