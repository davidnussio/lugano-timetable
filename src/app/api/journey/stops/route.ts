import { Effect } from "effect";
import { Swisstopo } from "~/terrain/swisstopo-client";
import { respond } from "../../respond";

// Stops rarely change: the CDN asks swisstopo at most once a day, and keeps
// serving the old list while refreshing it or when it is down
const CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";

// GET /api/journey/stops → the public transport stops of Ticino, of every
// operator, by the codes of transport.opendata.ch
export function GET() {
  return respond(
    Effect.gen(function* () {
      const swisstopo = yield* Swisstopo;
      return yield* swisstopo.stops();
    }),
    CACHE_CONTROL
  );
}
