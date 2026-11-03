import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { LineStore, Lines } from "../line-catalog";
import { type Departure, InTimeStatus, type Target } from "../models";
import { Timetable } from "../timetable";

const departure = (Route: string, Dir: string, Target = "486"): Departure => ({
  Target,
  Route,
  RouteCode: Route,
  Dir,
  Routing: "77",
  Dest: "Lugano",
  Img: `${Route}.jpg`,
  Time: "07:42",
  Pred: InTimeStatus.OnTime,
});

const target = (id: string): Target => ({
  Name: id,
  Label: id,
  Identifiers: [id],
  Coordinates: [],
});

// A timetable whose stops each serve one line, recording what is asked
const timetable = (asked: Array<ReadonlyArray<number>>) =>
  Layer.succeed(
    Timetable,
    Timetable.of({
      targets: Effect.succeed(Array.from({ length: 12 }, (_, i) => target(String(i + 1)))),
      itineraries: (stops) =>
        Effect.sync(() => {
          asked.push(stops);
          return {
            ready: true,
            data: stops.map((stop) => departure(String(stop), "1", String(stop))),
          };
        }),
      routing: () => Effect.succeed({ ready: true, data: [] }),
    })
  );

const lines = (asked: Array<ReadonlyArray<number>> = []) =>
  Lines.layerNoDeps.pipe(Layer.provide([LineStore.layerMemory, timetable(asked)]));

describe("Lines", () => {
  it.effect("learns the lines of the departures", () =>
    Effect.gen(function* () {
      const service = yield* Lines;
      yield* service.record([departure("2", "1"), departure("2", "2"), departure("3", "1")]);
      // Below ten lines the scan starts: let it finish
      const known = yield* service.lines;
      assert.deepStrictEqual(
        known.map((line) => [line.code, line.directions.map((d) => d.dir)]),
        [
          ["2", ["1", "2"]],
          ["3", ["1"]],
        ]
      );
    }).pipe(Effect.provide(lines()))
  );

  it.effect("scans the stops once while the lines are few", () => {
    const asked: Array<ReadonlyArray<number>> = [];
    return Effect.gen(function* () {
      const service = yield* Lines;
      assert.deepStrictEqual(yield* service.lines, []);
      // The scan runs detached: give it its turn
      yield* Effect.yieldNow;
      yield* Effect.sleep(0);
      const known = yield* service.lines;
      assert.strictEqual(known.length, 12);
      assert.strictEqual(asked.length, 1);
      yield* service.lines;
      assert.strictEqual(asked.length, 1);
    }).pipe(Effect.provide(lines(asked)));
  });
});
