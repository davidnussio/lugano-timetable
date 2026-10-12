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

// Main line of the timer: what to do and in how long. Once on the way, the
// time to leave would stand still while walking: show the walk left instead.
export function timerHeadline(
  countdown: Countdown,
  stage: Stage = "away"
): {
  readonly label: string;
  readonly ms: number;
} {
  if (countdown.departureMs < -60_000) return { label: "Bus partito", ms: 0 };
  if (countdown.walkingMs === undefined || stage === "arrived") {
    return countdown.departureMs > 0
      ? { label: stage === "arrived" ? "Bus tra" : "Parte tra", ms: countdown.departureMs }
      : { label: "In arrivo", ms: 0 };
  }
  if (stage === "walking") {
    return { label: "Alla fermata tra", ms: countdown.walkingMs };
  }
  return countdown.leaveMs >= 0
    ? { label: "Esci tra", ms: countdown.leaveMs }
    : { label: "In ritardo di", ms: -countdown.leaveMs };
}
