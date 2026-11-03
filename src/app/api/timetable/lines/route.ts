import { Effect } from "effect";
import { Timetable } from "~/timetable/timetable";
import { respond } from "../../respond";

// The lines change with the timetable: the CDN asks at most once an hour,
// and keeps serving the old list while refreshing it or when TPL is down
const CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400";

// GET /api/timetable/lines → the TPL lines, with the platforms of each
// direction
export function GET() {
  return respond(
    Effect.gen(function* () {
      const timetable = yield* Timetable;
      return yield* timetable.lines;
    }),
    CACHE_CONTROL
  );
}
