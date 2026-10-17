import { Clock, Effect } from "effect";
import { Opendata } from "~/journey/opendata-client";
import type { Routine } from "./models";
import { decide, type Occurrence, occurrence, shouldQuery } from "./schedule";
import type { Subscriber } from "./schema";
import { RoutineStore, type StateKey } from "./store";
import { WebPush } from "./web-push-client";

// One run of the scheduler, every minute: the routines inside their window
// ask the timetable again and get the notifications that are due. The
// others cost nothing but a look at the stored state. A routine that fails
// (timetable down, push service busy) is tried again at the next tick: its
// state is saved only once the message is out.

export interface TickSummary {
  // Routines inside their window
  readonly watched: number;
  readonly queried: number;
  readonly sent: number;
  // Subscriptions dropped by the browser, forgotten
  readonly removed: number;
  readonly failed: number;
}

interface Due {
  readonly subscriber: Subscriber;
  readonly routine: Routine;
  readonly occurrence: Occurrence;
  readonly key: StateKey;
}

type Outcome = "skipped" | "checked" | "sent" | "gone" | "failed";

const CONCURRENCY = 8;

export const tick = Effect.gen(function* () {
  const store = yield* RoutineStore;
  const opendata = yield* Opendata;
  const push = yield* WebPush;
  yield* push.available;
  const now = yield* Clock.currentTimeMillis;

  const due = (yield* store.subscribers()).flatMap((subscriber) =>
    subscriber.routines.flatMap((routine): ReadonlyArray<Due> => {
      const found = occurrence(routine, now);
      return found === undefined
        ? []
        : [
            {
              subscriber,
              routine,
              occurrence: found,
              key: { subscriber: subscriber.key, routine: routine.id, date: found.date },
            },
          ];
    })
  );
  // All the states in one round trip, to leave out the routines with
  // nothing to do before taking their lock
  const states = yield* store.states(due.map((item) => item.key));
  const candidates = due.filter((_, index) => shouldQuery(states[index], now));

  const watch = ({ subscriber, routine, occurrence: found, key }: Due) =>
    Effect.gen(function* () {
      // Read again under the lock: another tick may have just sent
      const [state] = yield* store.states([key]);
      if (!shouldQuery(state, now)) return "skipped" as Outcome;
      const connections = yield* opendata.connections(
        routine.from.id,
        routine.to.id,
        found.arriveAt,
        { arrival: true }
      );
      const decision = decide(routine, found, state, connections, now);
      if (decision.message !== undefined) {
        const result = yield* push.send(subscriber.subscription, decision.message, {
          ttlSeconds: Math.max(60, Math.ceil(((decision.expiresAt ?? now) - now) / 1000)),
          topic: routine.id,
        });
        if (result === "gone") return "gone" as Outcome;
      }
      yield* store.setState(key, decision.state);
      return (decision.message === undefined ? "checked" : "sent") as Outcome;
    });

  const run = (item: Due) =>
    Effect.acquireUseRelease(
      store.lock(item.subscriber.key, item.routine.id),
      (locked) => (locked ? watch(item) : Effect.succeed("skipped" as Outcome)),
      (locked) => (locked ? store.unlock(item.subscriber.key, item.routine.id) : Effect.void)
    ).pipe(
      Effect.catch((error) =>
        Effect.as(
          Effect.logWarning(`Failed to check routine ${item.routine.id}`, error),
          "failed" as Outcome
        )
      )
    );

  const outcomes = yield* Effect.forEach(candidates, run, { concurrency: CONCURRENCY });

  const gone = new Set(
    candidates.filter((_, index) => outcomes[index] === "gone").map((item) => item.subscriber.key)
  );
  yield* Effect.forEach(gone, (key) => store.remove(key), { discard: true });

  const count = (outcome: Outcome) => outcomes.filter((value) => value === outcome).length;
  return {
    watched: due.length,
    queried: count("checked") + count("sent") + count("gone"),
    sent: count("sent"),
    removed: gone.size,
    failed: count("failed"),
  } satisfies TickSummary;
});
