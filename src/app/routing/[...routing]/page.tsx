"use client";

import { SquareChartGantt } from "lucide-react";
import useSWR from "swr";
import Loading from "~/app/components/loading";
import { Timetable } from "~/app/components/timetable";
import { cn } from "~/lib/utils";
import {
  InTimeStatus,
  Routing,
  RoutingStatus,
  Target,
} from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

type RoutingPageProps = {
  params: {
    routing: string[];
  };
};

type RoutingWithTarget = Routing & Pick<Target, "Label" | "Name">;

const RouteUIDToProgressive = [
  19, 20, 21, 22, 23, 32, 33, 24, 25, 26, 27, 28, 29, 0, 0, 30, 31,
];

function routeToFile(routeUID: string) {
  const index = RouteUIDToProgressive.indexOf(parseInt(routeUID));
  return index !== -1 ? index + 1 : 0;
}

function timetableImageUrl(code: string, route: string, dir: string) {
  const routeNumber = routeToFile(route) + 400;
  return `http://bs.tplsa.ch/images/Theoretical/${routeNumber}_${
    dir === "1" ? "A_" : "R_"
  }${code}.png`;
}

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
  const route = params.routing[1];
  const dir = params.routing[2];

  if (isLoading) return <Loading />;

  return (
    <ul className="divide-y divide-gray-200 border rounded-lg">
      {data.map((target) => (
        <li
          key={target.UID}
          className={cn("px-4 py-2", {
            "bg-amber-50": target.Status === RoutingStatus.CurrentStation,
            "bg-gray-50": target.Status === RoutingStatus.PassedStation,
          })}>
          <div className="flex space-x-2 items-center justify-between">
            <div className="flex-shrink">
              <Circle color={target.Status} />
            </div>
            <div className="flex flex-grow flex-col items-start">
              <div className="flex w-full items-baseline">
                {target.Name}
                <span className="text-xs font-light pl-1">
                  {target.Label.split(",")[0]}
                </span>
              </div>
            </div>
            <div>
              <Timetable url={timetableImageUrl(target.Code, route, dir)} />
            </div>
            <div>
              <div
                className={cn(
                  "text-xs",
                  target.Pred === InTimeStatus.Delayed &&
                    target.Status === RoutingStatus.FeatureStation &&
                    "text-red-500 "
                )}>
                {target.Time}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
