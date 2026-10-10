import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Identifier } from "~/timetable/schema";
import { Timetable } from "~/timetable/timetable";
import { respond } from "../respond";

const Query = Schema.Struct({
  itineraries: Schema.NonEmptyArray(Identifier),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// GET /api/timetable/itineraries?itineraries=486&itineraries=487
export function GET(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { itineraries } = yield* decodeQuery({
        itineraries: request.nextUrl.searchParams.getAll("itineraries"),
      });
      const timetable = yield* Timetable;
      return yield* timetable.itineraries(itineraries);
    })
  );
}
