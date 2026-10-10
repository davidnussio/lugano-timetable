import type { Countdown } from "./plan";

export type Tone = "ok" | "soon" | "late" | "gone";

// How urgent the timer is: based on the time to leave when the walk is known,
// on the departure otherwise
export function timerTone({ departureMs, leaveMs, walkingMs }: Countdown): Tone {
  if (departureMs < -60_000) return "gone";
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

// Main line of the timer: what to do and in how long
export function timerHeadline(countdown: Countdown): {
  readonly label: string;
  readonly ms: number;
} {
  if (countdown.departureMs < -60_000) return { label: "Bus partito", ms: 0 };
  if (countdown.walkingMs === undefined) {
    return countdown.departureMs > 0
      ? { label: "Parte tra", ms: countdown.departureMs }
      : { label: "In arrivo", ms: 0 };
  }
  return countdown.leaveMs >= 0
    ? { label: "Esci tra", ms: countdown.leaveMs }
    : { label: "In ritardo di", ms: -countdown.leaveMs };
}
