import {
  Array as Arr,
  Clock,
  Context,
  Effect,
  Exit,
  Layer,
  Option,
  Order,
  Ref,
  Schedule,
} from "effect";
import type {
  Coordinates,
  Departure,
  Itinerary,
  Monitored,
  RoutingStop,
  Target,
} from "./models";
import { type Monitor, RtpiClient, type RtpiError } from "./rtpi-client";
import { SessionStore } from "./session-store";

// A fresh session answers "KO" for a while: poll like the official app, then
// give up and let the client retry with `ready: false`.
const pollSchedule = Schedule.max([
  Schedule.spaced("500 millis"),
  Schedule.recurs(8),
]);

const coordinates = (identifier: {
  readonly Id: string;
  readonly Lat?: string;
  readonly Lon?: string;
}): Option.Option<Coordinates> => {
  const Lat = Number(identifier.Lat);
  const Lon = Number(identifier.Lon);
  return Number.isFinite(Lat) && Number.isFinite(Lon) && Lat !== 0 && Lon !== 0
    ? Option.some({ Id: identifier.Id, Lat, Lon })
    : Option.none();
};

const byName = Order.mapInput(Order.String, (target: Target) => target.Name);

// Numeric route codes first, in ascending order
const byRouteCode = Order.mapInput(Order.Number, (itinerary: Itinerary) => {
  const code = Number(itinerary.RouteCode);
  return Number.isNaN(code) ? Number.POSITIVE_INFINITY : code;
});

export class Timetable extends Context.Service<
  Timetable,
  {
    readonly targets: Effect.Effect<ReadonlyArray<Target>, RtpiError>;
    itineraries(
      targets: ReadonlyArray<number>
    ): Effect.Effect<Monitored<Departure>, RtpiError>;
    // parameters: [target, route, direction, routing?]
    routing(
      parameters: ReadonlyArray<number>
    ): Effect.Effect<Monitored<RoutingStop>, RtpiError>;
  }
>()("lugano-timetable/timetable/Timetable") {
  static readonly layerNoDeps = Layer.effect(
    Timetable,
    Effect.gen(function* () {
      const rtpi = yield* RtpiClient;
      const sessions = yield* SessionStore;

      // The stop list rarely changes: keep successful results for an hour
      const targets = yield* rtpi.fullTargets.pipe(
        Effect.map(
          Arr.map(
            (target): Target => ({
              Name: target.Name,
              Label: target.Label,
              Identifiers: target.Identifiers.map((identifier) => identifier.Id),
              Coordinates: Arr.getSomes(target.Identifiers.map(coordinates)),
            })
          )
        ),
        Effect.map(Arr.sort(byName)),
        Effect.cachedWithTTL((exit) => (Exit.isSuccess(exit) ? "1 hour" : 0))
      );

      // Every query gets its own session: the server monitors one set of
      // stops per session, so sharing it between queries resets the monitor.
      const monitored = <A>(
        key: string,
        request: (source: string) => Effect.Effect<Monitor<A>, RtpiError>
      ) =>
        Effect.gen(function* () {
          const stored = yield* sessions.get(key);
          const source = yield* Ref.make(Option.getOrElse(stored, () => ""));

          const poll = Ref.get(source).pipe(
            Effect.flatMap(request),
            Effect.tap((response) =>
              Effect.andThen(
                Ref.set(source, response.source),
                sessions.set(key, response.source)
              )
            )
          );

          const { ready, data } = yield* Effect.repeat(poll, {
            schedule: pollSchedule,
            until: (response) => response.ready,
          });
          return { ready, data };
        });

      return Timetable.of({
        targets,
        itineraries: Effect.fn("Timetable.itineraries")(function* (stops) {
          const result = yield* monitored(
            `rtpi:session:GETITINERARIES:${stops.join(",")}`,
            (source) => rtpi.itineraries(source, stops)
          );
          const now = yield* Clock.currentTimeMillis;
          const data = Arr.sort(result.data, byRouteCode).map(
            (itinerary): Departure =>
              itinerary.Wait === undefined
                ? itinerary
                : { ...itinerary, DepartureAt: now + itinerary.Wait * 1000 }
          );
          return { ...result, data };
        }),
        routing: Effect.fn("Timetable.routing")(function* (parameters) {
          return yield* monitored(
            `rtpi:session:GETROUTING:${parameters.join(",")}`,
            (source) => rtpi.routing(source, parameters)
          );
        }),
      });
    })
  );

  static readonly layer = Timetable.layerNoDeps.pipe(
    Layer.provide([RtpiClient.layer, SessionStore.layer])
  );
}
