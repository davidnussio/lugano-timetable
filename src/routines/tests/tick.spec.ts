import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import type { Connection } from "~/journey/models";
import { type ConnectionsOptions, Opendata, OpendataError } from "~/journey/opendata-client";
import type { PushMessage, Routine } from "../models";
import { zurichTime } from "../schedule";
import type { Subscriber } from "../schema";
import { RoutineStore, subscriberKey } from "../store";
import { tick } from "../tick";
import { type PushOptions, WebPush } from "../web-push-client";

const MIN = 60_000;
const at = (time: string) => zurichTime("2026-10-16", time);

const connection: Connection = {
  legs: [
    {
      trip: "000606",
      category: "B",
      line: "6",
      destination: "Lugano, Centro",
      from: { id: "8591577", name: "Albonago" },
      to: { id: "8591603", name: "Lugano, Centro" },
      departure: { scheduled: at("07:37") },
      arrival: { scheduled: at("07:52") },
    },
  ],
};

const routine: Routine = {
  id: "abcdef0123456789",
  from: { id: "8591577", name: "Albonago" },
  to: { id: "8591603", name: "Lugano, Centro" },
  days: [1, 2, 3, 4, 5],
  arriveBy: "08:00",
  walkMinutes: 6,
  durationMinutes: 15,
  paused: false,
};

const endpoint = "https://push.example.com/send/123";
const subscriber: Subscriber = {
  key: subscriberKey(endpoint),
  subscription: { endpoint, keys: { p256dh: "p256dh", auth: "auth" } },
  routines: [routine],
};

interface Query {
  readonly from: string;
  readonly to: string;
  readonly at?: number;
  readonly options?: ConnectionsOptions;
}

// Opendata answering with `answer()`, recording the queries
const fakeOpendata = (
  queries: Array<Query>,
  answer: () => Effect.Effect<ReadonlyArray<Connection>, OpendataError> = () =>
    Effect.succeed([connection])
) =>
  Layer.succeed(
    Opendata,
    Opendata.of({
      stations: () => Effect.succeed([]),
      connections: (from, to, at, options) => {
        queries.push({ from, to, at, options });
        return answer();
      },
      legs: () => Effect.succeed([]),
      stationboard: () => Effect.succeed([]),
    })
  );

interface Sent {
  readonly message: PushMessage;
  readonly options: PushOptions;
}

const fakePush = (sent: Array<Sent>, result: "sent" | "gone" = "sent") =>
  Layer.succeed(
    WebPush,
    WebPush.of({
      available: Effect.void,
      send: (_, message, options) =>
        Effect.sync(() => {
          sent.push({ message, options });
          return result;
        }),
    })
  );

const services = (
  queries: Array<Query>,
  sent: Array<Sent>,
  {
    result,
    answer,
  }: {
    result?: "sent" | "gone";
    answer?: () => Effect.Effect<ReadonlyArray<Connection>, OpendataError>;
  } = {}
) =>
  Layer.mergeAll(RoutineStore.layerMemory, fakeOpendata(queries, answer), fakePush(sent, result));

const saved = Effect.gen(function* () {
  const store = yield* RoutineStore;
  yield* store.save(subscriber);
  return store;
});

describe("tick", () => {
  it.effect("sends the first notice once, with an arrival query", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    return Effect.gen(function* () {
      yield* saved;
      yield* TestClock.setTime(at("07:11"));
      const summary = yield* tick;
      assert.deepStrictEqual(summary, { watched: 1, queried: 1, sent: 1, removed: 0, failed: 0 });
      assert.deepStrictEqual(queries, [
        { from: "8591577", to: "8591603", at: at("08:00"), options: { arrival: true } },
      ]);
      assert.strictEqual(sent[0].message.title, "Esci alle 7:31 per il 6 delle 7:37");
      assert.deepStrictEqual(sent[0].options, { ttlSeconds: 25 * 60, topic: routine.id });

      // The same minute again (an overlapping or retried run): nothing
      const again = yield* tick;
      assert.strictEqual(again.sent, 0);
      assert.strictEqual(queries.length, 1);

      yield* TestClock.setTime(at("07:31"));
      yield* tick;
      assert.deepStrictEqual(
        sent.map(({ message }) => message.title),
        ["Esci alle 7:31 per il 6 delle 7:37", "Esci ora"]
      );
      // Done for the day: no more queries
      yield* TestClock.setTime(at("07:40"));
      yield* tick;
      assert.strictEqual(queries.length, 2);
    }).pipe(Effect.provide(services(queries, sent)));
  });

  it.effect("leaves the timetable alone outside the window", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    return Effect.gen(function* () {
      const store = yield* saved;
      yield* store.save({
        ...subscriber,
        routines: [routine, { ...routine, id: "paused0123456789", paused: true }],
      });
      yield* TestClock.setTime(at("06:00"));
      const summary = yield* tick;
      assert.strictEqual(summary.watched, 0);
      assert.strictEqual(queries.length, 0);
    }).pipe(Effect.provide(services(queries, sent)));
  });

  it.effect("asks again only every 5 minutes while far from leaving", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    return Effect.gen(function* () {
      yield* saved;
      for (const minute of [0, 1, 2, 3, 4, 5]) {
        yield* TestClock.setTime(at("07:00") + minute * MIN);
        yield* tick;
      }
      assert.strictEqual(queries.length, 2);
      assert.strictEqual(sent.length, 0);
    }).pipe(Effect.provide(services(queries, sent)));
  });

  it.effect("forgets a subscription dropped by the browser", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    return Effect.gen(function* () {
      const store = yield* saved;
      yield* TestClock.setTime(at("07:11"));
      const summary = yield* tick;
      assert.strictEqual(summary.removed, 1);
      assert.deepStrictEqual(yield* store.subscribers(), []);
    }).pipe(Effect.provide(services(queries, sent, { result: "gone" })));
  });

  it.effect("tries again at the next tick when the timetable fails", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    let down = true;
    const answer = () =>
      down
        ? Effect.fail(new OpendataError({ endpoint: "connections", cause: "504" }))
        : Effect.succeed([connection]);
    return Effect.gen(function* () {
      yield* saved;
      yield* TestClock.setTime(at("07:11"));
      const failed = yield* tick;
      assert.strictEqual(failed.failed, 1);
      assert.strictEqual(sent.length, 0);
      down = false;
      yield* TestClock.setTime(at("07:12"));
      const summary = yield* tick;
      assert.strictEqual(summary.sent, 1);
    }).pipe(Effect.provide(services(queries, sent, { answer })));
  });

  it.effect("skips a routine another tick is handling", () => {
    const queries: Array<Query> = [];
    const sent: Array<Sent> = [];
    return Effect.gen(function* () {
      const store = yield* saved;
      assert.isTrue(yield* store.lock(subscriber.key, routine.id));
      yield* TestClock.setTime(at("07:11"));
      const summary = yield* tick;
      assert.strictEqual(summary.sent, 0);
      assert.strictEqual(queries.length, 0);
      // Released at the end of the other tick
      yield* store.unlock(subscriber.key, routine.id);
      assert.strictEqual((yield* tick).sent, 1);
    }).pipe(Effect.provide(services(queries, sent)));
  });

  it.effect("fails when the push keys are not configured", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(tick);
      assert.strictEqual(error._tag, "RoutinesUnavailable");
    }).pipe(
      Effect.provide(
        Layer.mergeAll(RoutineStore.layerMemory, fakeOpendata([]), WebPush.layerUnavailable)
      )
    )
  );
});

describe("RoutineStore", () => {
  it.effect("forgets a device saved without routines", () =>
    Effect.gen(function* () {
      const store = yield* saved;
      yield* store.save({ ...subscriber, routines: [] });
      assert.deepStrictEqual(yield* store.subscribers(), []);
    }).pipe(Effect.provide(RoutineStore.layerMemory))
  );

  it.effect("is off without Redis", () =>
    Effect.gen(function* () {
      const store = yield* RoutineStore;
      const error = yield* Effect.flip(store.available);
      assert.strictEqual(error.missing, "redis");
    }).pipe(Effect.provide(RoutineStore.layerUnavailable))
  );

  it("keys the subscriptions by a hash of the endpoint", () => {
    assert.strictEqual(subscriberKey(endpoint), subscriberKey(endpoint));
    assert.notStrictEqual(subscriberKey(endpoint), subscriberKey(`${endpoint}4`));
    assert.notInclude(subscriberKey(endpoint), "push.example.com");
    assert.match(subscriberKey(endpoint), /^[A-Za-z0-9_-]{22}$/);
  });
});
