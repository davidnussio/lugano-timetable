import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Opendata } from "~/journey/opendata-client";
import { StationId } from "~/journey/schema";
import { respond } from "../../respond";

const Query = Schema.Struct({ id: StationId });
const decodeQuery = Schema.decodeUnknownEffect(Query);

// The busiest stops are shared with other operators: enough to still fill
// the list once the client keeps only the buses of TPL
const LIMIT = 30;

// The forecasts change every minute or so
const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=30";

// GET /api/journey/stationboard?id=8591603
export function GET(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { id } = yield* decodeQuery(
        Object.fromEntries(request.nextUrl.searchParams)
      );
      const opendata = yield* Opendata;
      return yield* opendata.stationboard(id, LIMIT);
    }),
    CACHE_CONTROL
  );
}
