"use client";

import { Bus, Info, List, MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LineBadge } from "~/app/components/line-badge";
import { LiveStatus } from "~/app/components/live-status";
import { PageHeader } from "~/app/components/page-header";
import { SkeletonList } from "~/app/components/skeleton-list";
import { useLines } from "~/hooks/use-lines";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { useTargets } from "~/hooks/use-targets";
import { useI18n } from "~/i18n/i18n-provider";
import { town } from "~/lib/format";
import { type LineBus, lineBuses } from "~/lib/line-buses";
import { lineColor } from "~/lib/lines";
import { cn } from "~/lib/utils";
import type { Departure, RoutingStop, Target } from "~/timetable/models";
import type { LineMapBus, LineMapStop } from "./line-map";

// MapLibre needs the browser: loaded only when the map is shown
const LineMap = dynamic(() => import("./line-map").then((module) => module.LineMap), {
  ssr: false,
});

// Height of a stop of the line, in pixels: the buses are placed on it
const ROW = 56;

type Mode = "list" | "map";

// A line in one direction: its stops in order and where its buses are
export function LineView({ route, dir }: { route: string; dir?: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const { lines, isError: linesError } = useLines();
  const line = lines?.find((candidate) => candidate.route === route);
  const direction =
    line?.directions.find((candidate) => candidate.dir === dir) ?? line?.directions[0];
  const [mode, setMode] = useState<Mode>("list");
  const color = lineColor(route);
  const now = useNow();
  const targets = useTargets();

  // The stops of the line, from the routing of one of its trips
  const routing = useMonitored<RoutingStop>(
    "/api/timetable/routing",
    "routing",
    direction ? [direction.target, route, direction.dir, direction.routing] : null
  );
  const stops = routing.data;

  // The departures of every stop of the line: where its trips get next
  const platforms = useMemo(
    () => (stops.length > 0 ? [...new Set(stops.map((stop) => stop.UID))] : null),
    [stops]
  );
  const itineraries = useMonitored<Departure>(
    "/api/timetable/itineraries",
    "itineraries",
    platforms
  );

  const buses = useMemo(
    () =>
      direction && now > 0
        ? lineBuses(stops, itineraries.data, route, direction.dir, now)
        : [],
    [stops, itineraries.data, route, direction, now]
  );

  // The next bus of the line at each stop, in minutes
  const nextAt = useMemo(() => {
    const next = new Map<string, number>();
    if (!direction || now === 0) return next;
    for (const departure of itineraries.data) {
      if (departure.Route !== route || departure.Dir !== direction.dir) continue;
      if (departure.DepartureAt === undefined) continue;
      const minutes = Math.max(0, Math.round((departure.DepartureAt - now) / 60_000));
      const current = next.get(departure.Target);
      if (current === undefined || minutes < current) next.set(departure.Target, minutes);
    }
    return next;
  }, [itineraries.data, route, direction, now]);

  const targetOf = (uid: string) =>
    targets?.find((target) => target.Identifiers.includes(uid));

  const choose = (chosen: string) => router.replace(`/linee/${route}/${chosen}`);

  const header = (
    <PageHeader
      back="/linee"
      title={
        <span className="flex items-center gap-2">
          {line && (
            <LineBadge img={line.img} route={route} line={line.code} size={26} className="rounded-md" />
          )}
          <span className="truncate">
            {direction ? m.lines.towards(direction.dest) : m.lines.title}
          </span>
        </span>
      }
      subtitle={stops.length > 0 ? m.lines.buses(buses.length) : undefined}
      actions={
        stops.length > 0 ? (
          <span className="pr-2">
            <LiveStatus error={itineraries.isError} />
          </span>
        ) : undefined
      }
    />
  );

  if (lines !== undefined && line === undefined) {
    return (
      <main className="flex flex-1 flex-col">
        {header}
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {lines.length === 0 ? m.lines.learning : m.lines.notFound}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      {header}
      <div className="space-y-3 px-4 pb-6 pt-3">
        {line && line.directions.length > 1 && (
          <Segmented
            label={m.lines.direction}
            value={direction?.dir}
            onChange={choose}
            options={line.directions.map((candidate) => ({
              value: candidate.dir,
              label: candidate.dest,
            }))}
          />
        )}
        <Segmented
          label={m.nav.label}
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          options={[
            { value: "list", label: m.lines.list, Icon: List },
            { value: "map", label: m.lines.map, Icon: MapIcon },
          ]}
        />
        <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          {m.lines.estimate}
        </p>

        {(routing.isError || linesError) && stops.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {m.common.serviceUnavailable}
          </p>
        ) : routing.isLoading || stops.length === 0 ? (
          <div className="-mx-4">
            <SkeletonList rows={8} />
          </div>
        ) : mode === "map" ? (
          <MapPanel
            stops={stops}
            buses={buses}
            targetOf={targetOf}
            route={route}
            dir={direction?.dir ?? ""}
            color={color}
          />
        ) : (
          <StopRail
            stops={stops}
            buses={buses}
            nextAt={nextAt}
            targetOf={targetOf}
            route={route}
            dir={direction?.dir ?? ""}
            color={color}
          />
        )}
      </div>
    </main>
  );
}

// The trip of a bus, from its next stop
const tripHref = (bus: LineBus, route: string, dir: string) =>
  `/routing/${bus.departure.Target}/${route}/${dir}/${bus.departure.Routing}`;

function busLabel(m: ReturnType<typeof useI18n>["m"], bus: LineBus, stop: string) {
  const minutes = Math.round(bus.waitMs / 60_000);
  const where = bus.waiting
    ? m.lines.busWaiting(stop, minutes)
    : bus.position === bus.next
      ? m.lines.busAt(stop)
      : m.lines.busHeading(stop, minutes);
  return bus.delayed ? `${where} · ${m.lines.delayed}` : where;
}

// The stops one below the other on the colored line, the buses on it
function StopRail({
  stops,
  buses,
  nextAt,
  targetOf,
  route,
  dir,
  color,
}: {
  stops: ReadonlyArray<RoutingStop>;
  buses: ReadonlyArray<LineBus>;
  nextAt: ReadonlyMap<string, number>;
  targetOf: (uid: string) => Target | undefined;
  route: string;
  dir: string;
  color: string;
}) {
  const { m } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* The line, from the first stop to the last */}
      <span
        className="absolute left-7 w-1 -translate-x-1/2 rounded-full"
        style={{ top: ROW / 2, height: (stops.length - 1) * ROW, backgroundColor: color }}
      />
      <ol>
        {stops.map((stop, index) => {
          const target = targetOf(stop.UID);
          const minutes = nextAt.get(stop.UID);
          const content = (
            <>
              <span className="relative w-14 shrink-0 self-stretch">
                <span
                  className={cn(
                    "absolute left-7 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-card",
                    index === 0 || index === stops.length - 1 ? "size-4" : "size-3"
                  )}
                  style={{ borderColor: color }}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    "truncate",
                    index === 0 || index === stops.length - 1 ? "font-semibold" : "font-medium"
                  )}>
                  {stop.Name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{town(stop.Label)}</span>
              </span>
              {minutes !== undefined && (
                <span className="pr-3 font-mono text-sm tabular-nums text-muted-foreground">
                  {minutes === 0 ? "0'" : `${minutes}'`}
                </span>
              )}
            </>
          );
          return (
            <li
              key={`${stop.UID}-${index}`}
              className="border-t border-border/60 first:border-t-0"
              style={{ height: ROW }}>
              {target ? (
                <Link
                  href={`/fermata/${target.Identifiers.join("/")}`}
                  aria-label={m.lines.departuresOf(stop.Name)}
                  className="flex h-full items-center gap-1 transition-colors hover:bg-muted/60 active:bg-muted">
                  {content}
                </Link>
              ) : (
                <div className="flex h-full items-center gap-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {buses.map((bus) => (
        <Link
          key={bus.uid}
          href={tripHref(bus, route, dir)}
          aria-label={busLabel(m, bus, stops[bus.next]?.Name ?? "")}
          title={busLabel(m, bus, stops[bus.next]?.Name ?? "")}
          className="absolute left-7 z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-md transition-[top] duration-1000 ease-linear"
          style={{
            top: bus.position * ROW + ROW / 2,
            backgroundColor: color,
            boxShadow: bus.delayed
              ? "0 0 0 2px var(--card), 0 0 0 4px var(--destructive)"
              : "0 0 0 2px var(--card)",
          }}>
          <Bus className="size-4" />
          {bus.position === bus.next && !bus.waiting && (
            <span
              className="absolute inset-0 -z-10 animate-ping rounded-full opacity-40"
              style={{ backgroundColor: color }}
            />
          )}
        </Link>
      ))}
    </div>
  );
}

// The line on the map, the buses between the stops
function MapPanel({
  stops,
  buses,
  targetOf,
  route,
  dir,
  color,
}: {
  stops: ReadonlyArray<RoutingStop>;
  buses: ReadonlyArray<LineBus>;
  targetOf: (uid: string) => Target | undefined;
  route: string;
  dir: string;
  color: string;
}) {
  const { m } = useI18n();
  const located: Array<LineMapStop | undefined> = stops.map((stop) => {
    const target = targetOf(stop.UID);
    const platform =
      target?.Coordinates.find((coordinates) => coordinates.Id === stop.UID) ??
      target?.Coordinates[0];
    return platform && {
      name: stop.Name,
      lat: platform.Lat,
      lon: platform.Lon,
      href: target && `/fermata/${target.Identifiers.join("/")}`,
    };
  });
  const mapStops = located.filter((stop): stop is LineMapStop => stop !== undefined);

  // Between the two stops around it, as far as it went
  const mapBuses = buses.flatMap((bus): ReadonlyArray<LineMapBus> => {
    const from = located[Math.floor(bus.position)];
    const to = located[Math.min(Math.ceil(bus.position), located.length - 1)];
    if (!from || !to) return [];
    const fraction = bus.position - Math.floor(bus.position);
    return [
      {
        uid: bus.uid,
        lat: from.lat + (to.lat - from.lat) * fraction,
        lon: from.lon + (to.lon - from.lon) * fraction,
        label: busLabel(m, bus, stops[bus.next]?.Name ?? ""),
        href: tripHref(bus, route, dir),
        delayed: bus.delayed,
      },
    ];
  });

  return (
    <div className="relative h-[60dvh] min-h-80 overflow-hidden rounded-2xl border border-border shadow-sm">
      <LineMap stops={mapStops} buses={mapBuses} color={color} />
    </div>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: ReadonlyArray<{
    value: string;
    label: string;
    Icon?: React.ComponentType<{ className?: string }>;
  }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-muted p-1">
      {options.map(({ value: option, label: text, Icon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
            option === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}>
          {Icon && <Icon className="size-4 shrink-0" />}
          <span className="truncate">{text}</span>
        </button>
      ))}
    </div>
  );
}
