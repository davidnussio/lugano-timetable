import { Effect, Schema } from "effect";
import type { Opendata, OpendataError } from "~/journey/opendata-client";
import type { Swisstopo, SwisstopoError } from "~/terrain/swisstopo-client";
import type { Reliability } from "~/timetable/reliability-store";
import type { RtpiError } from "~/timetable/rtpi-client";
import { runtime } from "~/timetable/runtime";
import type { Timetable } from "~/timetable/timetable";

// Runs a route handler program and maps its failures to HTTP responses. With
// `cacheControl`, successful responses are cached by the CDN; a function
// picks the header from the response body.
export function respond<A>(
  program: Effect.Effect<
    A,
    RtpiError | OpendataError | SwisstopoError | Schema.SchemaError,
    Timetable | Opendata | Swisstopo | Reliability
  >,
  cacheControl?: string | ((body: A) => string)
): Promise<Response> {
  const upstreamError = (error: RtpiError | OpendataError | SwisstopoError) =>
    Effect.as(
      Effect.logError(`${error._tag} request failed`, error),
      Response.json({ error: "Upstream error" }, { status: 502 })
    );

  return runtime.runPromise(
    program.pipe(
      Effect.map((body) => {
        const header =
          typeof cacheControl === "function" ? cacheControl(body) : cacheControl;
        return Response.json(
          body,
          header ? { headers: { "Cache-Control": header } } : {}
        );
      }),
      Effect.catchTags({
        SchemaError: () =>
          Effect.succeed(
            Response.json({ error: "Bad request" }, { status: 400 })
          ),
        RtpiError: upstreamError,
        OpendataError: upstreamError,
        SwisstopoError: upstreamError,
      })
    )
  );
}
