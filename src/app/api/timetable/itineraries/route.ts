import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Reliability } from "~/timetable/reliability-store";
import { Identifier } from "~/timetable/schema";
import { Timetable } from "~/timetable/timetable";
import { respond } from "../../respond";
import { monitoredCacheControl } from "../monitored-cache";

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
      const result = yield* timetable.itineraries(itineraries);
      // Learn how late the buses about to leave are, detached: the answer
      // never waits for the storage
      const reliability = yield* Reliability;
      yield* Effect.forkDetach(reliability.record(result.data));
      return result;
    }),
    monitoredCacheControl
  );
}
