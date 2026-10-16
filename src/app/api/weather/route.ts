import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { OpenMeteo } from "~/weather/open-meteo-client";
import { respond } from "../respond";

const Query = Schema.Struct({
  lat: Schema.NumberFromString.check(Schema.isFinite()),
  lon: Schema.NumberFromString.check(Schema.isFinite()),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// The models are updated about every 15 minutes: the callers round the
// position (about 5 km), so that nearby users share the copy of the CDN
const CACHE = "public, s-maxage=600";

// GET /api/weather?lat=46.00&lon=8.95
// → { "precipitation": 2.4, "snowfall": 0, "code": 63 }
export function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return respond(
    Effect.gen(function* () {
      const { lat, lon } = yield* decodeQuery(params);
      const openMeteo = yield* OpenMeteo;
      return yield* openMeteo.current(lat, lon);
    }),
    CACHE
  );
}
