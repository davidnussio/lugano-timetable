import type { Messages } from "~/i18n/messages";
import type { Countdown, Stage } from "./plan";

export type Tone = "ok" | "soon" | "late" | "gone";

// How urgent the timer is: based on the time to leave when the walk is known,
// on the departure otherwise. At the stop the user can only wait.
export function timerTone(
  { departureMs, leaveMs, walkingMs }: Countdown,
  stage: Stage = "away"
): Tone {
  if (departureMs < -60_000) return "gone";
  if (stage === "arrived" && walkingMs !== undefined) {
    return departureMs > 60_000 ? "ok" : "soon";
  }
  if (walkingMs === undefined) {
    return departureMs > 5 * 60_000 ? "ok" : departureMs > 60_000 ? "soon" : "late";
  }
  return leaveMs > 2 * 60_000 ? "ok" : leaveMs >= 0 ? "soon" : "late";
}

export const toneText: Record<Tone, string> = {
  ok: "text-success",
  soon: "text-warning",
  late: "text-destructive",
  gone: "text-muted-foreground",
};

export const toneBackground: Record<Tone, string> = {
  ok: "bg-success",
  soon: "bg-warning",
  late: "bg-destructive",
  gone: "bg-muted-foreground",
};

// What the countdown counts down to, so that it can be told apart at a glance
export type Phase = "leave" | "walk" | "bus" | "gone" | "transfer" | "arrival";

export type Headline = {
  readonly label: string;
  readonly ms: number;
  readonly phase: Phase;
};

// Main line of the timer: what to do and in how long. Once on the way, the
// time to leave would stand still while walking: show the walk left instead.
export function timerHeadline(
  m: Messages,
  countdown: Countdown,
  stage: Stage = "away"
): Headline {
  const { headline } = m;
  if (countdown.departureMs < -60_000) return { label: headline.busGone, ms: 0, phase: "gone" };
  if (countdown.walkingMs === undefined || stage === "arrived") {
    return countdown.departureMs > 0
      ? {
          label: stage === "arrived" ? headline.busIn : headline.departsIn,
          ms: countdown.departureMs,
          phase: "bus",
        }
      : { label: headline.arriving, ms: 0, phase: "bus" };
  }
  if (stage === "walking") {
    return { label: headline.atStopIn, ms: countdown.walkingMs, phase: "walk" };
  }
  return countdown.leaveMs >= 0
    ? { label: headline.leaveIn, ms: countdown.leaveMs, phase: "leave" }
    : { label: headline.lateBy, ms: -countdown.leaveMs, phase: "leave" };
}
