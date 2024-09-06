"use client";

import useSWR from "swr";
import Loading from "~/app/components/loading";
import { cn } from "~/lib/utils";
import { Routing, RoutingStatus, Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

type RoutingPageProps = {
  params: {
    routing: string[];
  };
};

type RoutingWithTarget = Routing & Pick<Target, "Label" | "Name">;

function useRouting(routing: string[]) {
  const url = `/api/timetable/routing?${routing
    .map((i) => `routing=${i}`)
    .join("&")}`;
  const { data, error, isLoading } = useSWR<RoutingWithTarget[]>(url, fetcher, {
    refreshInterval: 10_000,
  });

  return {
    data: data ?? [],
    isLoading,
    isError: error,
  };
}

const Circle = ({ color }: { color: number }) => (
  <div
    className={cn("h-4 w-4 rounded bg-gray-400", {
      "bg-amber-400 animate-pulse": color === RoutingStatus.CurrentStation,
      "bg-green-400": color === RoutingStatus.PassedStation,
    })}></div>
);

export default function RoutingPage({ params }: RoutingPageProps) {
  const { data, isLoading } = useRouting(params.routing);

  if (isLoading) return <Loading />;

  return (
    <ul role="list" className="divide-y divide-gray-200 border rounded-lg">
      {data.map((target) => (
        <li
          key={target.UID}
          className={cn("px-4 py-2", {
            "bg-amber-50": target.Status === RoutingStatus.CurrentStation,
          })}>
          <div className="flex space-x-2 items-center justify-between">
            <div className="flex-shrink">
              <Circle color={target.Status} />
            </div>
            <div className="flex flex-grow flex-col items-start">
              {target.Name}
              {/* <div className="text-xs font-light">{target.Label}</div> */}
            </div>
            <div>
              <div className="text-xs font-light">{target.Time}</div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
