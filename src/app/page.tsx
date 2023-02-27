import type { Target } from "~/timetable/models";
import { FiltrableListTargets } from "./targets";

const getTargets = async (): Promise<Target[]> => {
  const response = await fetch("http://localhost:3000/api/timetable/targets", {
    next: { revalidate: 86_400 },
  });
  const targets = await response.json();
  return targets.data;
};

export default async function Home() {
  const targets = await getTargets();
  return (
    <main>
      <h1 className="m-4 text-3xl font-bold tracking-tight text-center">
        Fermate
      </h1>
      <FiltrableListTargets targets={targets} />
    </main>
  );
}
