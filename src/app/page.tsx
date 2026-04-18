import { getTargets } from "~/timetable/api";
import { FiltrableListTargets } from "./targets";

export default async function Home() {
  const data = await getTargets();

  return (
    <main>
      <FiltrableListTargets targets={data} />
    </main>
  );
}
