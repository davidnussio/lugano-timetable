import { Effect, Schema } from "effect";
import { defaultLocale, locales } from "~/i18n/config";
import { StationId } from "~/journey/schema";
import { MAX_ROUTINES } from "./models";

// What the browser sends to save its usual journeys, and what the server
// keeps of them

const Station = Schema.Struct({
  id: StationId,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});

const Minutes = (maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum: 0, maximum }));

export const Routine = Schema.Struct({
  // Also the Topic of the push messages: URL-safe and 32 characters at most
  id: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{8,32}$/)),
  from: Station,
  to: Station,
  days: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 7 }))).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(7)
  ),
  arriveBy: Schema.String.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/)),
  walkMinutes: Minutes(60),
  durationMinutes: Minutes(240),
  paused: Schema.Boolean,
  // Saved before the app spoke other languages: Italian, as they were sent
  lang: Schema.Literals(locales).pipe(Schema.withDecodingDefaultKey(Effect.succeed(defaultLocale))),
});

// `PushSubscription.toJSON()` of the browser
export const PushSubscriptionJson = Schema.Struct({
  endpoint: Schema.String.check(Schema.isPattern(/^https:\/\//), Schema.isMaxLength(2048)),
  expirationTime: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  keys: Schema.Struct({
    p256dh: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
    auth: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
  }),
});
export type PushSubscriptionJson = typeof PushSubscriptionJson.Type;

// PUT /api/routines: the journeys of a device, replacing the saved ones
export const SaveBody = Schema.Struct({
  subscription: PushSubscriptionJson,
  routines: Schema.Array(Routine).check(Schema.isMaxLength(MAX_ROUTINES)),
});

// DELETE /api/routines: forget a device
export const DeleteBody = Schema.Struct({
  endpoint: PushSubscriptionJson.fields.endpoint,
});

// A device with its journeys, as stored
export const Subscriber = Schema.Struct({
  // Hash of the endpoint of the subscription
  key: Schema.String,
  subscription: PushSubscriptionJson,
  routines: Schema.Array(Routine),
});
export type Subscriber = typeof Subscriber.Type;

export const RoutineState = Schema.Struct({
  checkedAt: Schema.Number,
  key: Schema.optionalKey(Schema.String),
  leaveAt: Schema.optionalKey(Schema.Number),
  stage: Schema.optionalKey(Schema.Literals(["first", "now"])),
  updates: Schema.optionalKey(Schema.Number),
});
