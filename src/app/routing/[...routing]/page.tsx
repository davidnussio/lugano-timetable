"use client";
import { use } from "react";

import Loading from "~/app/components/loading";
import { Timetable } from "~/app/components/timetable";
import { cn } from "~/lib/utils";
import { useMonitored } from "~/hooks/use-monitored";
import { InTimeStatus, RoutingStatus, type RoutingStop } from "~/timetable/models";

type RoutingPageProps = {
  params: Promise<{
    routing: string[];
  }>;
};

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

const Circle = ({ status }: { status: number }) => (
  <div
    className={cn(
      "h-3.5 w-3.5 rounded-full border-2 transition-all",
      {
        "border-muted-foreground bg-transparent": status === RoutingStatus.FeatureStation,
        "border-accent bg-accent animate-pulse shadow-xs shadow-accent/50": status === RoutingStatus.CurrentStation,
        "border-primary bg-primary": status === RoutingStatus.PassedStation,
      }
    )}
  />
);

export default function RoutingPage(props: RoutingPageProps) {
  const params = use(props.params);
  const { data, isLoading, isError } = useMonitored<RoutingStop>(
    "/api/timetable/routing",
    "routing",
    params.routing
  );
  const route = params.routing[1];
  const dir = params.routing[2];

  if (isError && data.length === 0)
    return (
      <p className="px-4 py-8 text-center text-sm text-destructive">
        Servizio non disponibile, nuovo tentativo in corso…
      </p>
    );
  if (isLoading) return <Loading />;

  return (
    <div className="px-4 pb-4">
      <ul className="divide-y divide-border rounded-xl overflow-hidden bg-card border border-border">
        {data.map((target, index) => (
          <li
            key={target.UID}
            className={cn("transition-colors", {
              "bg-accent/5": target.Status === RoutingStatus.CurrentStation,
              "bg-muted/50": target.Status === RoutingStatus.PassedStation,
            })}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col items-center">
                <Circle status={target.Status} />
                {index < data.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-3 mt-1",
                      target.Status === RoutingStatus.PassedStation
                        ? "bg-primary"
                        : "bg-border"
                    )}
                  />
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-medium truncate",
                      target.Status === RoutingStatus.PassedStation
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}>
                    {target.Name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {target.Label.split(",")[0]}
                  </span>
                </div>
              </div>
              <Timetable url={timetableImageUrl(target.Code, route, dir)} />
              <div
                className={cn(
                  "text-sm font-mono min-w-[3.5rem] text-right",
                  target.Pred === InTimeStatus.Delayed &&
                    target.Status === RoutingStatus.FeatureStation
                    ? "text-destructive font-medium"
                    : target.Status === RoutingStatus.PassedStation
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}>
                {target.Time}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
