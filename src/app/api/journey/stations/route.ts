import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Opendata } from "~/journey/opendata-client";
import { respond } from "../../respond";

const Query = Schema.Union([
  Schema.Struct({ query: Schema.NonEmptyString }),
  Schema.Struct({
    lat: Schema.NumberFromString.check(Schema.isFinite()),
    lon: Schema.NumberFromString.check(Schema.isFinite()),
  }),
]);
const decodeQuery = Schema.decodeUnknownEffect(Query);

// Stops rarely change: names for a day, positions for an hour
const BY_NAME = "public, s-maxage=86400, stale-while-revalidate=604800";
const NEARBY = "public, s-maxage=3600, stale-while-revalidate=86400";

// GET /api/journey/stations?query=bellinz
// GET /api/journey/stations?lat=46.0049&lon=8.9515
export function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return respond(
    Effect.gen(function* () {
      const query = yield* decodeQuery(params);
      const opendata = yield* Opendata;
      return yield* opendata.stations(query);
    }),
    "query" in params ? BY_NAME : NEARBY
  );
}
