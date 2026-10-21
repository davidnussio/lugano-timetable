import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Opendata } from "~/journey/opendata-client";
import { StationId } from "~/journey/schema";
import { arrivingBy } from "~/journey/when";
import { Identifier } from "~/timetable/schema";
import { respond } from "../../respond";

const Query = Schema.Struct({
  from: StationId,
  to: StationId,
  // Epoch milliseconds, now when missing
  at: Schema.optionalKey(Identifier),
  // "1": arriving by `at` rather than leaving from it
  arrive: Schema.optionalKey(Schema.Literal("1")),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// The forecasts change every minute or so
const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=30";

// GET /api/journey/connections?from=8591577&to=8505213&at=1791738360000&arrive=1
export function GET(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { from, to, at, arrive } = yield* decodeQuery(
        Object.fromEntries(request.nextUrl.searchParams)
      );
      const opendata = yield* Opendata;
      const connections = yield* opendata.connections(from, to, at, arrive === "1");
      // Arriving by a time, not hours before it
      return arrive === "1" && at !== undefined ? arrivingBy(connections, at) : connections;
    }),
    CACHE_CONTROL
  );
}
