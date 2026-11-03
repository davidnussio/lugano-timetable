import { Effect } from "effect";
import { Lines } from "~/timetable/line-catalog";
import type { Line } from "~/timetable/lines";
import { respond } from "../../respond";

// The lines change with the timetable: the CDN asks at most every ten
// minutes. An empty list (still being learned) is never cached.
const cacheControl = (lines: ReadonlyArray<Line>) =>
  lines.length > 0 ? "public, s-maxage=600, stale-while-revalidate=3600" : "no-store";

// GET /api/timetable/lines → the TPL lines, with a routing per direction
export function GET() {
  return respond(
    Effect.gen(function* () {
      const lines = yield* Lines;
      return yield* lines.lines;
    }),
    cacheControl
  );
}
