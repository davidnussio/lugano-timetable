import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Reliability } from "~/timetable/reliability-store";
import { respond } from "../../respond";

const Code = Schema.String.check(Schema.isPattern(/^\d{1,10}$/));
const Query = Schema.Struct({
  target: Code,
  route: Code,
  dir: Code,
  time: Schema.String.check(Schema.isPattern(/^\d{2}:\d{2}$/)),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// A departure gets at most one new sample a day: a few minutes old is right
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

// GET /api/timetable/reliability?target=486&route=12&dir=1&time=07:42
// → { "samples": 14, "median": 95, "p80": 170, "lateShare": 0.21 }
export function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return respond(
    Effect.gen(function* () {
      const departure = yield* decodeQuery(params);
      const reliability = yield* Reliability;
      return yield* reliability.stats(departure);
    }),
    CACHE_CONTROL
  );
}
