import { Effect } from "effect";
import { connection } from "next/server";
import { runtime } from "~/timetable/runtime";
import { Timetable } from "~/timetable/timetable";
import { FiltrableListTargets } from "./targets";

export default async function Home() {
  // Render on request: the stop list comes from the live RTPI server
  await connection();
  const targets = await runtime.runPromise(
    Effect.gen(function* () {
      const timetable = yield* Timetable;
      return yield* timetable.targets;
    })
  );

  return (
    <main className="flex flex-1 flex-col">
      <FiltrableListTargets targets={targets} />
    </main>
  );
}
