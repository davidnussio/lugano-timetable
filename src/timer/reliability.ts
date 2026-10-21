import type { Messages } from "~/i18n/messages";
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

function usually(m: Messages, median: number): string {
  const minutes = Math.round(median / 60);
  if (minutes === 0) return m.reliability.onTime;
  return minutes > 0 ? m.reliability.late(minutes) : m.reliability.early(-minutes);
}

// "Entro" is an upper bound: rounded up
function within(m: Messages, p80: number): string {
  const minutes = Math.ceil(p80 / 60);
  return minutes > 0 ? m.reliability.within(minutes) : m.reliability.allOnTime;
}

// What the past days say about the departure, undefined with too few
export function reliabilityNote(
  m: Messages,
  stats: DelayStats | undefined
): ReliabilityNote | undefined {
  if (
    stats === undefined ||
    stats.samples < MIN_SAMPLES ||
    stats.median === undefined ||
    stats.p80 === undefined
  ) {
    return undefined;
  }
  const summary = `${usually(m, stats.median)} · ${within(m, stats.p80)} ${m.reliability.days(stats.samples)}`;
  // A delay that changes from day to day can shrink while walking: keep the
  // difference to the usual one as a margin. One always the same is already
  // in the real-time estimate.
  const margin = Math.round((stats.p80 - Math.max(0, stats.median)) / 60);
  return stats.p80 >= LATE_P80_S && margin > 0 ? { summary, margin } : { summary };
}
