"use client";

import { ArrowRight, Clock, Flag, Footprints, Route, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import useSWR from "swr";
import { Time } from "~/app/components/leg-time";
import { TransportBadge } from "~/app/components/transport-badge";
import { useTargets } from "~/hooks/use-targets";
import type { Connection } from "~/journey/models";
import { formatClimb } from "~/lib/format";
import { cn } from "~/lib/utils";
import {
  type ConnectionStatus,
  expected,
  formatTime,
  laterPlan,
  type Transfer,
} from "~/timer/journey";
import { minutesLeft } from "~/timer/plan";
import { useTimer } from "~/timer/timer-provider";
import { fetcher } from "~/utils/fetcher";

const statusText: Record<ConnectionStatus, string> = {
  ok: "text-success",
  tight: "text-warning",
  missed: "text-destructive",
};

const statusBackground: Record<ConnectionStatus, string> = {
  ok: "bg-success/10",
  tight: "bg-warning/10",
  missed: "bg-destructive/10",
};

function slackLabel({ slackMs, status }: Transfer): string {
  if (status === "missed") return `mancano ${minutesLeft(-slackMs)} min`;
  const minutes = Math.floor(slackMs / 60_000);
  return minutes > 0 ? `${minutes} min di margine` : "nessun margine";
}

// The legs of the journey with the state of every transfer
export function JourneySection({ now }: { now: number }) {
  const { timer, legs, journey } = useTimer();
  if (!timer?.journey || !legs || !journey) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Route className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {timer.journey.from.name} → {timer.journey.to.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Arrivo previsto alle{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatTime(journey.arrivalAt + (timer.journey.walkAfterMs ?? 0))}
            </span>
          </p>
        </div>
        {journey.status !== "ok" && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              statusBackground[journey.status],
              statusText[journey.status]
            )}>
            {journey.status === "tight" ? "Stretta" : "A rischio"}
          </span>
        )}
      </div>
      <ol className="space-y-2 px-4 py-3 text-sm">
        {legs.map((leg, index) => {
          const done = expected(leg.arrival) < now;
          const change = index > 0 ? journey.transfers[index - 1] : undefined;
          return (
            <Fragment key={`${leg.trip}-${index}`}>
              {change && (
                <li
                  className={cn(
                    "flex gap-2 rounded-xl px-3 py-2 text-xs font-medium",
                    statusBackground[change.status],
                    statusText[change.status]
                  )}>
                  {change.status === "ok" ? (
                    <Clock className="mt-px size-3.5 shrink-0" />
                  ) : (
                    <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">Cambio a {change.at.name}</p>
                    <p className="flex items-center gap-1 font-normal">
                      {change.walkingMs > 0 && (
                        <>
                          <Footprints className="size-3.5" />
                          {Math.max(1, Math.round(change.walkingMs / 60_000))} min a piedi
                          {formatClimb(change.climb) && ` ${formatClimb(change.climb)}`} ·
                        </>
                      )}{" "}
                      {slackLabel(change)}
                    </p>
                  </div>
                </li>
              )}
              <li className={cn("flex gap-3", done && "opacity-50")}>
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
                  <p className="flex items-baseline gap-2">
                    <Time timing={leg.arrival} className="w-[4.75rem] shrink-0 font-semibold" />
                    <span className="truncate">{leg.to.name}</span>
                  </p>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <FallbackCard />
    </section>
  );
}

// The way to fall back on when a connection is lost
function FallbackCard() {
  const { fallback, reroute, journey, timer } = useTimer();
  if (!fallback || !journey) return null;
  const { plan, index } = fallback;
  const first = plan.legs[0];
  const arrival = expected(plan.legs[plan.legs.length - 1].arrival) + (plan.walkAfterMs ?? 0);
  const later = minutesLeft(arrival - journey.arrivalAt - (timer?.journey?.walkAfterMs ?? 0));

  return (
    <div className="space-y-2 border-t border-border bg-destructive/5 p-4">
      <p className="text-sm font-semibold">Alternativa da {journey.transfers[index].at.name}</p>
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        {plan.legs.map((leg, i) => (
          <Fragment key={`${leg.trip}-${i}`}>
            {i > 0 && <ArrowRight className="size-3.5 text-muted-foreground" />}
            <TransportBadge line={leg.line} category={leg.category} operator={leg.operator} size={22} />
          </Fragment>
        ))}
        <span className="text-muted-foreground">
          alle <span className="font-mono tabular-nums text-foreground">{formatTime(expected(first.departure))}</span>,
          arrivo{" "}
          <span className="font-mono tabular-nums text-foreground">{formatTime(arrival)}</span>
          {later > 0 && <span className="font-semibold text-destructive"> +{later} min</span>}
        </span>
      </p>
      <button
        type="button"
        onClick={() => reroute(index, plan)}
        className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
        Usa questo percorso
      </button>
    </div>
  );
}

// A later departure arriving at the same time, while still at home
export function LaterSuggestion({ leaving }: { leaving: boolean }) {
  const { timer, legs, settings, speeds, startJourney } = useTimer();
  const targets = useTargets();
  const journey = timer?.journey;
  const { data: plans } = useSWR<ReadonlyArray<Connection>>(
    journey && !leaving
      ? `/api/journey/connections?from=${journey.from.id}&to=${journey.to.id}`
      : null,
    fetcher,
    { refreshInterval: 120_000 }
  );
  if (!journey || !legs || !plans || leaving) return null;
  const plan = laterPlan(plans, { legs }, { speed: speeds[settings.pace] });
  if (!plan) return null;
  const first = plan.legs[0];
  const arrival = expected(plan.legs[plan.legs.length - 1].arrival);

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/5 p-4 shadow-sm">
      <Flag className="size-5 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Puoi uscire più tardi</p>
        <p className="text-xs text-muted-foreground">
          Linea {first.line} alle{" "}
          <span className="font-mono tabular-nums">{formatTime(expected(first.departure))}</span>,
          arrivo alle <span className="font-mono tabular-nums">{formatTime(arrival)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => startJourney(plan, journey.from, journey.to, targets)}
        className="h-9 shrink-0 rounded-xl bg-success px-3 text-sm font-semibold text-white">
        Usa questo
      </button>
    </section>
  );
}
