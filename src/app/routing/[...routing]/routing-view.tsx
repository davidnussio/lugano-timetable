"use client";

import { Bus, ChevronUp, MapPin } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { LineBadge } from "~/app/components/line-badge";
import { LiveStatus } from "~/app/components/live-status";
import { PageHeader } from "~/app/components/page-header";
import { SkeletonList } from "~/app/components/skeleton-list";
import { Timetable } from "~/app/components/timetable";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { minutesUntilClock, town } from "~/lib/format";
import { lineColor } from "~/lib/lines";
import { type BusPosition, busIndex, busPosition, stopState } from "~/lib/trip";
import { cn } from "~/lib/utils";
import { minutesLeft } from "~/timer/plan";
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

// Passed stops kept visible above the bus when the rest are collapsed
const PASSED_VISIBLE = 1;

export default function RoutingPage(props: RoutingPageProps) {
  const params = use(props.params);
  const { data, isLoading, isError } = useMonitored<RoutingStop>(
    "/api/timetable/routing",
    "routing",
    params.routing
  );
  const [target, route, dir] = params.routing;
  const [showPassed, setShowPassed] = useState(false);
  const now = useNow();
  const color = lineColor(route);

  const position = busPosition(data);
  const bus = busIndex(position, data.length);
  const mine = data.findIndex((stop) => stop.UID === target);
  // Stops hidden above the bus until the user asks for them
  const hidden = showPassed ? 0 : Math.max(0, bus - PASSED_VISIBLE);

  // Bring the bus into view once the data arrives
  const busRow = useRef<HTMLLIElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || data.length === 0) return;
    scrolled.current = true;
    busRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [data.length]);

  const destination = data.at(-1);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        back="/"
        title={
          <span className="flex items-center gap-2">
            <LineBadge img={route} route={route} size={26} className="rounded-md" />
            <span className="truncate">{destination?.Name ?? "Percorso"}</span>
          </span>
        }
      />

      {isError && data.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Servizio non disponibile, nuovo tentativo in corso…
        </p>
      ) : isLoading ? (
        <SkeletonList rows={8} />
      ) : (
        <div className="space-y-3 px-4 pb-6 pt-3">
          {mine !== -1 && (
            <TripSummary
              stops={data}
              position={position}
              bus={bus}
              mine={mine}
              now={now}
              color={color}
              error={isError}
            />
          )}

          <ol className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowPassed(true)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60">
                  <span className="grid w-8 place-items-center">
                    <ChevronUp className="size-4" />
                  </span>
                  {hidden === 1
                    ? "Mostra la fermata precedente"
                    : `Mostra ${hidden} fermate precedenti`}
                </button>
              </li>
            )}
            {data.map((stop, index) =>
              index < hidden ? null : (
                <StopRow
                  key={stop.UID}
                  ref={index === Math.min(bus, data.length - 1) ? busRow : undefined}
                  stop={stop}
                  index={index}
                  count={data.length}
                  position={position}
                  mine={index === mine}
                  color={color}
                  timetable={timetableImageUrl(stop.Code, route, dir)}
                />
              )
            )}
          </ol>
        </div>
      )}
    </main>
  );
}

function TripSummary({
  stops,
  position,
  bus,
  mine,
  now,
  color,
  error,
}: {
  stops: ReadonlyArray<RoutingStop>;
  position: BusPosition;
  bus: number;
  mine: number;
  now: number;
  color: string;
  error: boolean;
}) {
  const myStop = stops[mine];
  const gone = bus > mine;
  const away = mine - bus;
  const minutes = now > 0 ? minutesUntilClock(myStop.Time, new Date(now)) : undefined;

  const where =
    position.kind === "origin"
      ? `Al capolinea ${stops[0]?.Name ?? ""}`
      : position.kind === "at"
        ? `Alla fermata ${stops[position.index].Name}`
        : position.kind === "between"
          ? `In viaggio verso ${stops[position.from + 1].Name}`
          : "Arrivato al capolinea";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" />
            {myStop.Name}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {gone
              ? "Bus già passato"
              : away === 0 && position.kind === "at"
                ? "Il bus è qui"
                : minutes !== undefined && minutes > 0
                  ? `Arriva tra ${minutesLeft(minutes * 60_000)} min`
                  : "In arrivo"}
          </p>
        </div>
        <span className="pt-0.5">
          <LiveStatus error={error} />
        </span>
      </div>
      <div className="mt-3 flex items-start gap-2 text-sm">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full text-white"
          style={{ backgroundColor: color }}>
          <Bus className="size-4" />
        </span>
        <span className="min-w-0 pt-1 leading-snug text-muted-foreground">
          {where}
          {!gone && away === 0 && position.kind === "between" && (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                prossima fermata
              </span>
            </>
          )}
          {!gone && away > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {away === 1 ? "1 fermata" : `${away} fermate`} da te
              </span>
            </>
          )}
        </span>
      </div>
    </section>
  );
}

function StopRow({
  ref,
  stop,
  index,
  count,
  position,
  mine,
  color,
  timetable,
}: {
  ref?: React.Ref<HTMLLIElement>;
  stop: RoutingStop;
  index: number;
  count: number;
  position: BusPosition;
  mine: boolean;
  color: string;
  timetable: string;
}) {
  const state = stopState(position, index);
  const previous = index > 0 ? stopState(position, index - 1) : undefined;
  const next = index < count - 1 ? stopState(position, index + 1) : undefined;
  // A segment is travelled once the bus reached its end
  const travelled = (s: typeof state) => s !== "upcoming";
  const busArriving = position.kind === "between" && position.from === index - 1;
  const delayed = stop.Pred === InTimeStatus.Delayed && state === "upcoming";
  const showTime = !(stop.Status === RoutingStatus.Origin && stop.Time === "00:00");

  return (
    <li
      ref={ref}
      className={cn(
        "relative flex min-h-14 items-stretch border-t border-border/60 first:border-t-0",
        mine && "bg-primary/[0.06]"
      )}>
      {/* Rail: the half segments meet in the node */}
      <div className="relative w-14 shrink-0">
        {previous !== undefined && (
          <Segment top travelled={travelled(state)} color={color} />
        )}
        {next !== undefined && (
          <Segment travelled={travelled(next)} color={color} />
        )}
        <Node state={state} mine={mine} color={color} />
        {busArriving && (
          <span
            className="absolute left-1/2 top-0 z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-md ring-2 ring-card"
            style={{ backgroundColor: color }}
            aria-label="Bus in viaggio">
            <Bus className="size-3.5" />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate",
              state === "passed" ? "text-muted-foreground" : "font-medium",
              (state === "current" || mine) && "font-semibold"
            )}>
            {stop.Name}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {state === "current" && (
              <span className="font-semibold text-success">Bus alla fermata</span>
            )}
            {mine && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px font-semibold text-primary">
                La tua fermata
              </span>
            )}
            {state !== "current" && !mine && town(stop.Label)}
          </span>
        </div>
        {showTime && (
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              state === "passed" && "text-muted-foreground/70",
              delayed && "font-semibold text-destructive",
              (state === "current" || mine) && "font-semibold"
            )}>
            {stop.Time}
          </span>
        )}
        <Timetable url={timetable} />
      </div>
    </li>
  );
}

function Segment({
  top,
  travelled,
  color,
}: {
  top?: boolean;
  travelled: boolean;
  color: string;
}) {
  return (
    <span
      className={cn(
        "absolute left-1/2 w-1 -translate-x-1/2",
        top ? "top-0 h-1/2" : "bottom-0 h-1/2",
        travelled && "bg-muted-foreground/25"
      )}
      style={travelled ? undefined : { backgroundColor: color }}
    />
  );
}

function Node({
  state,
  mine,
  color,
}: {
  state: "passed" | "current" | "upcoming";
  mine: boolean;
  color: string;
}) {
  const center = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

  if (state === "current") {
    return (
      <span className={cn(center, "z-10 grid size-8 place-items-center")}>
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-40"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative grid size-8 place-items-center rounded-full text-white shadow-md ring-2 ring-card"
          style={{ backgroundColor: color }}>
          <Bus className="size-4" />
        </span>
      </span>
    );
  }
  if (state === "passed") {
    return (
      <span
        className={cn(
          center,
          "rounded-full bg-muted-foreground/40",
          mine ? "size-3.5" : "size-2.5"
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        center,
        "rounded-full bg-card",
        mine ? "size-5 border-[5px] shadow-sm" : "size-3.5 border-[3px]"
      )}
      style={{ borderColor: color }}
    />
  );
}
