import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { type LegQuery, Opendata } from "~/journey/opendata-client";
import { respond } from "../../respond";

// <boarding stop>,<trip>,<scheduled departure in ms>,<last stop>
const Leg = Schema.String.check(
  Schema.isPattern(/^\d{7},[\w-]{1,20},\d{10,14},\d{7}$/)
);
const Query = Schema.Struct({
  leg: Schema.NonEmptyArray(Leg).check(Schema.isMaxLength(8)),
});
const decodeQuery = Schema.decodeUnknownEffect(Query);

const CACHE_CONTROL = "public, s-maxage=15, stale-while-revalidate=15";

function legQuery(value: string): LegQuery {
  const [from, trip, at, to] = value.split(",");
  return { from, trip, at: Number(at), to };
}

// GET /api/journey/legs?leg=8578997,004220,1791738360000,8505380&leg=…
export function GET(request: NextRequest) {
  return respond(
    Effect.gen(function* () {
      const { leg } = yield* decodeQuery({
        leg: request.nextUrl.searchParams.getAll("leg"),
      });
      const opendata = yield* Opendata;
      return yield* opendata.legs(leg.map(legQuery));
    }),
    CACHE_CONTROL
  );
}
