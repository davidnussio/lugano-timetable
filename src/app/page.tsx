import { getTargets } from "~/timetable/api";
import { FiltrableListTargets } from "./targets";
import { TopBar } from "./components/topbar";

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
      <TopBar title="Fermate" />
      <FiltrableListTargets targets={data} />
    </main>
  );
}
