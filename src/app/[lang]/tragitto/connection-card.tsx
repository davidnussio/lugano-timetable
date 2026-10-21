"use client";

import { Bell, BellRing, ChevronDown, ChevronRight, Footprints } from "lucide-react";
import { Fragment, useState } from "react";
import { TransportBadge } from "~/app/components/transport-badge";
import { useI18n } from "~/i18n/i18n-provider";
import { formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { Connection, PlannedLeg } from "~/journey/models";
import { expected, feasible, formatTime, type Leg } from "~/timer/journey";
import { Time } from "~/app/components/leg-time";

function connectionStart({ legs }: Connection): number {
  return expected(legs[0].departure) - (legs[0].walkBeforeMs ?? 0);
}

function connectionEnd({ legs, walkAfterMs }: Connection): number {
  return expected(legs[legs.length - 1].arrival) + (walkAfterMs ?? 0);
}

// Same first bus as the running timer
export function sameStart(a: PlannedLeg, b: PlannedLeg): boolean {
  return a.trip === b.trip && a.departure.scheduled === b.departure.scheduled;
}

const walkMinutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

function Walk({ ms }: { ms: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
      <Footprints className="size-3.5" />
      {walkMinutes(ms)}
    </span>
  );
}

export function ConnectionCard({
  connection,
  timed,
  after,
  onStart,
}: {
  connection: Connection;
  // The running timer follows this connection
  timed: boolean;
  // The bus the user stays on before this connection: the change from it
  // counts too
  after?: Leg;
  onStart: () => void;
}) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const { legs, walkAfterMs } = connection;
  const first = legs[0];
  const transfers = legs.length - 1;
  const atRisk = !feasible(after ? { legs: [after, ...legs] } : connection);

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        timed ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}>
      <div className="flex items-stretch">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 flex-col gap-2 p-3 text-left transition-colors hover:bg-muted/60 active:bg-muted">
          <span className="flex w-full items-baseline gap-2">
            <Time timing={first.departure} className="text-xl font-bold" />
            <span className="text-muted-foreground">→</span>
            <Time timing={legs[legs.length - 1].arrival} className="text-xl font-bold" />
            <span className="ml-auto shrink-0 text-sm font-medium text-muted-foreground">
              {formatDuration(connectionEnd(connection) - connectionStart(connection))}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {legs.map((leg, index) => (
              <Fragment key={`${leg.trip}-${index}`}>
                {index > 0 && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
                {leg.walkBeforeMs !== undefined && (
                  <>
                    <Walk ms={leg.walkBeforeMs} />
                    <ChevronRight className="size-3.5 text-muted-foreground/60" />
                  </>
                )}
                <TransportBadge line={leg.line} category={leg.category} operator={leg.operator} size={24} />
              </Fragment>
            ))}
            {walkAfterMs !== undefined && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
                <Walk ms={walkAfterMs} />
              </>
            )}
          </span>
          <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{m.journey.fromStop(first.from.name)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">
              {m.journey.transfers(transfers)}
            </span>
            {atRisk && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">
                {m.journey.atRisk}
              </span>
            )}
            {timed && <span className="shrink-0 font-medium text-primary">{m.common.timerOn}</span>}
            <ChevronDown
              className={cn("ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </span>
        </button>
        <button
          type="button"
          onClick={onStart}
          aria-label={m.journey.startTimer(formatTime(expected(first.departure)))}
          className={cn(
            "grid w-12 shrink-0 place-items-center border-l border-border transition-colors hover:bg-muted active:bg-muted",
            timed ? "text-primary" : "text-muted-foreground"
          )}>
          {timed ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        </button>
      </div>
      {open && <LegList connection={connection} />}
    </li>
  );
}

// Every leg with its stops and times
export function LegList({ connection }: { connection: Connection }) {
  const { m } = useI18n();
  return (
    <ol className="space-y-2 border-t border-border bg-muted/30 px-3 py-3 text-sm">
      {connection.legs.map((leg, index) => (
        <Fragment key={`${leg.trip}-${index}`}>
          {leg.walkBeforeMs !== undefined && (
            <li className="flex items-center gap-2 pl-14 text-xs text-muted-foreground">
              <Footprints className="size-3.5" />
              {m.journey.walk(walkMinutes(leg.walkBeforeMs))}
            </li>
          )}
          <li className="flex gap-3">
            <TransportBadge
              line={leg.line}
              category={leg.category}
              operator={leg.operator}
              size={28}
              className="mt-0.5 w-11"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex items-baseline gap-2">
                <Time timing={leg.departure} className="w-[4.75rem] shrink-0 font-semibold" />
                <span className="truncate">{leg.from.name}</span>
              </p>
              <p className="truncate pl-[5.25rem] text-xs text-muted-foreground">
                {m.journey.towards(leg.destination)}
              </p>
              <p className="flex items-baseline gap-2">
                <Time timing={leg.arrival} className="w-[4.75rem] shrink-0 font-semibold" />
                <span className="truncate">{leg.to.name}</span>
              </p>
            </div>
          </li>
        </Fragment>
      ))}
      {connection.walkAfterMs !== undefined && (
        <li className="flex items-center gap-2 pl-14 text-xs text-muted-foreground">
          <Footprints className="size-3.5" />
          {m.journey.walk(walkMinutes(connection.walkAfterMs))}
        </li>
      )}
    </ol>
  );
}
