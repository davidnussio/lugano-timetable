import { Effect, Schema } from "effect";
import type { RtpiError } from "~/timetable/rtpi-client";
import { runtime } from "~/timetable/runtime";
import type { Timetable } from "~/timetable/timetable";

// Runs a route handler program and maps its failures to HTTP responses.
export function respond<A>(
  program: Effect.Effect<A, RtpiError | Schema.SchemaError, Timetable>
): Promise<Response> {
  return runtime.runPromise(
    program.pipe(
      Effect.map((body) => Response.json(body)),
      Effect.catchTags({
        SchemaError: () =>
          Effect.succeed(
            Response.json({ error: "Bad request" }, { status: 400 })
          ),
        RtpiError: (error) =>
          Effect.as(
            Effect.logError("RTPI request failed", error),
            Response.json({ error: "Upstream error" }, { status: 502 })
          ),
      })
    )
  );
}
