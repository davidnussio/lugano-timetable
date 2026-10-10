import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Identifier } from "~/timetable/schema";
import { Timetable } from "~/timetable/timetable";
import { respond } from "../respond";

const Query = Schema.Struct({
  // [target, route, direction, routing?]
  routing: Schema.Array(Identifier).check(
    Schema.isMinLength(3),
    Schema.isMaxLength(4)
  ),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// GET /api/timetable/routing?routing=<target>&routing=<route>&routing=<dir>&routing=<routing>
export function GET(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { routing } = yield* decodeQuery({
        routing: request.nextUrl.searchParams.getAll("routing"),
      });
      const timetable = yield* Timetable;
      return yield* timetable.routing(routing);
    })
  );
}
