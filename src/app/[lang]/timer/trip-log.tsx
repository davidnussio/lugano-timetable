"use client";

import { ArrowRightLeft, Footprints, Hourglass, Route } from "lucide-react";
import { TimerBadge } from "~/app/components/timer-badge";
import { TransportBadge } from "~/app/components/transport-badge";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
import { formatDistance, formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import { formatTime } from "~/timer/journey";
import { type Step, tripSteps } from "~/timer/progress";
import type { ActiveTimer } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";

// "< 1 min" rather than "0 min" for a bus caught on the fly
const span = (ms: number) => (ms < 60_000 ? "< 1 min" : formatDuration(ms));

function delayLabel(m: Messages, delayMs: number | undefined): string | undefined {
  if (delayMs === undefined) return undefined;
  const minutes = Math.round(delayMs / 60_000);
  return minutes > 0
    ? m.timer.departedLate(minutes)
    : minutes < 0
      ? m.timer.departedEarly(-minutes)
      : m.timer.onTime;
}

function stepTitle(m: Messages, step: Step): string {
  switch (step.kind) {
    case "walk":
      return m.timer.stepWalk(step.to);
    case "wait":
      return m.timer.stepWait(step.stop);
    case "ride":
      return m.timer.stepRide(step.to);
    case "transfer":
      return m.timer.changeAt(step.stop);
  }
}

function stepDetail(m: Messages, step: Step): string {
  const duration = step.done ? span(step.ms) : m.timer.ongoing(span(step.ms));
  const extra =
    step.kind === "walk"
      ? step.meters === undefined
        ? undefined
        : formatDistance(m, step.meters)
      : step.kind === "ride"
        ? delayLabel(m, step.delayMs)
        : step.kind === "transfer" && step.walkingMs >= 30_000
          ? m.timer.walkMinutes(Math.max(1, Math.round(step.walkingMs / 60_000)))
          : undefined;
  return [duration, extra].filter(Boolean).join(" · ");
}

function StepIcon({ step, timer }: { step: Step; timer: ActiveTimer }) {
  if (step.kind === "ride") {
    // The bus of the timer as on the card above, the next legs by operator
    return step.index === 0 || step.category === undefined ? (
      <TimerBadge timer={timer} size={24} />
    ) : (
      <TransportBadge
        line={step.line}
        category={step.category}
        operator={step.operator}
        size={24}
      />
    );
  }
  const Icon =
    step.kind === "walk" ? Footprints : step.kind === "wait" ? Hourglass : ArrowRightLeft;
  return (
    <span
      className={cn(
        "grid size-6 place-items-center rounded-full",
        step.done ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
      )}>
      <Icon aria-hidden className="size-3.5" />
    </span>
  );
}

// The trip so far, above the countdown: when the user left, how long the
// walk, the waits and the rides took. Shown once a step is behind.
export function TripLog({ timer, now }: { timer: ActiveTimer; now: number }) {
  const { legs, journey } = useTimer();
  const { m } = useI18n();
  if (now === 0) return null;
  const steps = tripSteps(timer, legs, now, journey?.transfers);
  const first = steps[0];
  const last = steps.at(-1);
  if (first === undefined || last === undefined || !steps.some((step) => step.done)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <Route className="size-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{m.timer.trip}</p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {m.timer.tripTotal(span(last.at + last.ms - first.at))}
        </span>
      </div>
      <ol>
        {steps.map((step, index) => {
          const end = index === steps.length - 1;
          return (
            <li key={`${step.kind}-${step.at}`} className="flex gap-3">
              <time className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                {formatTime(step.at)}
              </time>
              <div className="flex w-7 shrink-0 flex-col items-center">
                <StepIcon step={step} timer={timer} />
                {!end && <span className="my-1 w-px flex-1 bg-border" />}
              </div>
              <div className={cn("min-w-0 flex-1", !end && "pb-3")}>
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    !step.done && "text-primary"
                  )}>
                  {stepTitle(m, step)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{stepDetail(m, step)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
