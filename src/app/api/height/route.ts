import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { Swisstopo } from "~/terrain/swisstopo-client";
import { respond } from "../respond";

const Query = Schema.Struct({
  lat: Schema.NumberFromString.check(Schema.isFinite()),
  lon: Schema.NumberFromString.check(Schema.isFinite()),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

// The ground does not move: the callers round the position so that the
// same points come back, cached by the CDN and the browser
const CACHE = "public, max-age=2592000, s-maxage=31536000, immutable";

// GET /api/height?lat=46.0049&lon=8.9515 → { "height": 273.4 }
export function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return respond(
    Effect.gen(function* () {
      const { lat, lon } = yield* decodeQuery(params);
      const swisstopo = yield* Swisstopo;
      return { height: yield* swisstopo.height(lat, lon) };
    }),
    CACHE
  );
}
