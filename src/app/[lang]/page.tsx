import { Effect } from "effect";
import { runtime } from "~/timetable/runtime";
import { Timetable } from "~/timetable/timetable";
import { FiltrableListTargets } from "./targets";

// The stop list rarely changes: render it once and refresh it in the
// background at most once an hour. If the RTPI server is down, the last list
// keeps being served.
export const revalidate = 3600;

export default async function Home() {
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
