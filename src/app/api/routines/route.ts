import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { DeleteBody, SaveBody } from "~/routines/schema";
import { RoutineStore, subscriberKey } from "~/routines/store";
import { WebPush } from "~/routines/web-push-client";
import { respond } from "../respond";

const decodeSave = Schema.decodeUnknownEffect(SaveBody);
const decodeDelete = Schema.decodeUnknownEffect(DeleteBody);

// A body that is not JSON is a bad request like a wrong one
const body = (request: NextRequest) =>
  Effect.promise(() => request.json().catch(() => undefined));

// GET /api/routines: 200 when the usual journeys can be saved, 503 when
// Redis or the VAPID keys are missing (the app then hides them)
export function GET() {
  return respond(
    Effect.gen(function* () {
      yield* (yield* RoutineStore).available;
      yield* (yield* WebPush).available;
      return { available: true };
    })
  );
}

// PUT /api/routines { subscription, routines }: the journeys of the device,
// replacing the saved ones. The browser keeps the list and sends all of it
// on every change (added, paused, deleted) and when the app opens, so that
// a renewed subscription or a lost entry is put right.
export function PUT(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { subscription, routines } = yield* decodeSave(yield* body(request));
      yield* (yield* WebPush).available;
      const store = yield* RoutineStore;
      yield* store.save({ key: subscriberKey(subscription.endpoint), subscription, routines });
      return { saved: routines.length };
    })
  );
}

// DELETE /api/routines { endpoint }: forgets the device
export function DELETE(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { endpoint } = yield* decodeDelete(yield* body(request));
      const store = yield* RoutineStore;
      yield* store.remove(subscriberKey(endpoint));
      return { removed: true };
    })
  );
}
