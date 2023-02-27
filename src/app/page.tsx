import { getTargets } from "~/timetable/api";
import { FiltrableListTargets } from "./targets";

// const useTargets = () => {
//   const url = "/api/timetable/targets";
//   const { data, error, isLoading } = useSWR<Target[]>(url, fetcher, {
//     refreshInterval: 0,
//   });

//   return {
//     data: data ?? [],
//     isLoading,
//     isError: error,
//   };
// };

export default async function Home() {
  const data = await getTargets();

  return (
    <main>
      <h1 className="m-4 text-3xl font-bold tracking-tight text-center">
        Fermate
      </h1>
      <FiltrableListTargets targets={data} />
    </main>
  );
}
