import type { DelayStats } from "~/timetable/reliability";

// Fewer days say more about chance than about the bus
export const MIN_SAMPLES = 5;
// One day in five the bus leaves this late or later: its delay is worth
// planning around
const LATE_P80_S = 3 * 60;

export interface ReliabilityNote {
  // "Di solito parte con +2 min · 80% entro +3 min (14 giorni)"
  readonly summary: string;
  // Minutes of a delay the bus may recover, when worth keeping as a margin
  readonly margin?: number;
}

function usually(median: number): string {
  const minutes = Math.round(median / 60);
  if (minutes === 0) return "Di solito parte in orario";
  return minutes > 0
    ? `Di solito parte con +${minutes} min`
    : `Di solito parte ${-minutes} min prima`;
}

// "Entro" is an upper bound: rounded up
function within(p80: number): string {
  const minutes = Math.ceil(p80 / 60);
  return minutes > 0 ? `80% entro +${minutes} min` : "80% in orario";
}

// What the past days say about the departure, undefined with too few
export function reliabilityNote(stats: DelayStats | undefined): ReliabilityNote | undefined {
  if (
    stats === undefined ||
    stats.samples < MIN_SAMPLES ||
    stats.median === undefined ||
    stats.p80 === undefined
  ) {
    return undefined;
  }
  const summary = `${usually(stats.median)} · ${within(stats.p80)} (${stats.samples} giorni)`;
  // A delay that changes from day to day can shrink while walking: keep the
  // difference to the usual one as a margin. One always the same is already
  // in the real-time estimate.
  const margin = Math.round((stats.p80 - Math.max(0, stats.median)) / 60);
  return stats.p80 >= LATE_P80_S && margin > 0 ? { summary, margin } : { summary };
}
