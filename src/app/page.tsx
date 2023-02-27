"use client";

import useSWR from "swr";
import type { Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";
import LoadingPage from "./fermata/[...fermata]/loading";
import { FiltrableListTargets } from "./targets";

const useTargets = () => {
  const url = "/api/timetable/targets";
  const { data, error, isLoading } = useSWR<Target[]>(url, fetcher, {
    refreshInterval: 10_000,
  });

  return {
    data: data ?? [],
    isLoading,
    isError: error,
  };
};

export default function Home() {
  const { data, isLoading } = useTargets();

  console.log(data);

  if (isLoading) return <LoadingPage />;

  return (
    <main>
      <h1 className="m-4 text-3xl font-bold tracking-tight text-center">
        Fermate
      </h1>
      <FiltrableListTargets targets={data} />
    </main>
  );
}
