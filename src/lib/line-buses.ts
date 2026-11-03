// Where the buses of a line are, without their GPS: the RTPI server only
// tells, for every stop, in how long each trip gets there. The stop a trip
// reaches first is the next one, and the time left to it, measured on the
// times between the stops of the line, places the bus between two of them.
import { type Departure, InTimeStatus, RoutingStatus } from "~/timetable/models";

export interface LineStop {
  readonly UID: string;
  readonly Time: string;
  readonly Status: RoutingStatus;
}

export interface LineBus {
  readonly uid: number;
  // Stops travelled from the first, with the fraction of the way to the
  // next: 2.5 is halfway between the third and the fourth stop
  readonly position: number;
  // Index of the next stop it reaches (or is at)
  readonly next: number;
  // Time to the next stop
  readonly waitMs: number;
  // Still at the first stop, waiting to leave
  readonly waiting: boolean;
  readonly delayed: boolean;
  // Its departure from the next stop: opens the trip
  readonly departure: Departure;
}

// At the stop from this close
const AT_STOP_MS = 30_000;
// Waiting at the first stop: shown when leaving within this time
const WAITING_MS = 15 * 60_000;
// Minutes between two stops when the times do not say
const DEFAULT_SEGMENT_MIN = 1.5;

const clockMinutes = (time: string): number | undefined => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
};

// Minutes from the first stop to each stop, never decreasing. The first stop
// of a trip comes with "00:00", and the times missing are filled in between
// their neighbours.
export function stopOffsets(stops: ReadonlyArray<LineStop>): ReadonlyArray<number> {
  const known: Array<number | undefined> = [];
  let previous: number | undefined;
  for (const stop of stops) {
    let minutes =
      stop.Status === RoutingStatus.Origin && stop.Time === "00:00"
        ? undefined
        : clockMinutes(stop.Time);
    // Across midnight
    if (minutes !== undefined && previous !== undefined && minutes < previous - 12 * 60) {
      minutes += 24 * 60;
    }
    if (minutes !== undefined && previous !== undefined && minutes < previous) {
      minutes = previous;
    }
    if (minutes !== undefined) previous = minutes;
    known.push(minutes);
  }

  const first = known.findIndex((minutes) => minutes !== undefined);
  if (first === -1) return stops.map((_, index) => index * DEFAULT_SEGMENT_MIN);
  const filled = known.slice();
  for (let i = first - 1; i >= 0; i--) filled[i] = filled[i + 1]! - DEFAULT_SEGMENT_MIN;
  for (let i = first + 1; i < filled.length; i++) {
    if (filled[i] !== undefined) continue;
    const end = filled.findIndex((minutes, j) => j > i && minutes !== undefined);
    if (end === -1) {
      filled[i] = filled[i - 1]! + DEFAULT_SEGMENT_MIN;
    } else {
      const start = filled[i - 1]!;
      const gap = end - (i - 1);
      filled[i] = start + (filled[end]! - start) / gap;
    }
  }
  const origin = filled[0]!;
  return filled.map((minutes) => minutes! - origin);
}

// The fractional position at `minutes` from the first stop, at most `next`
function positionAt(offsets: ReadonlyArray<number>, minutes: number, next: number): number {
  if (minutes <= offsets[0]) return 0;
  for (let i = next; i > 0; i--) {
    if (offsets[i - 1] <= minutes) {
      const span = offsets[i] - offsets[i - 1];
      return span <= 0 ? i : i - 1 + Math.min(1, (minutes - offsets[i - 1]) / span);
    }
  }
  return 0;
}

const leavesAt = (departure: Departure, now: number) =>
  departure.DepartureAt ??
  (departure.Wait === undefined ? undefined : now + departure.Wait * 1000);

// The buses of `route` in direction `dir` along `stops`, from the departures
// of those stops, the furthest first
export function lineBuses(
  stops: ReadonlyArray<LineStop>,
  departures: ReadonlyArray<Departure>,
  route: string,
  dir: string,
  now: number
): ReadonlyArray<LineBus> {
  const indexOf = new Map(stops.map((stop, index) => [stop.UID, index]));
  // The stop each trip reaches first
  const nearest = new Map<number, { departure: Departure; index: number; at: number }>();
  for (const departure of departures) {
    if (departure.Route !== route || departure.Dir !== dir) continue;
    if (departure.Uid === undefined) continue;
    const index = indexOf.get(departure.Target);
    const at = leavesAt(departure, now);
    if (index === undefined || at === undefined) continue;
    const current = nearest.get(departure.Uid);
    if (
      current === undefined ||
      at < current.at ||
      (at === current.at && index < current.index)
    ) {
      nearest.set(departure.Uid, { departure, index, at });
    }
  }

  const offsets = stopOffsets(stops);
  const buses: Array<LineBus> = [];
  for (const [uid, { departure, index, at }] of nearest) {
    const waitMs = Math.max(0, at - now);
    const waiting = index === 0;
    if (waiting && waitMs > WAITING_MS) continue;
    const position =
      waitMs <= AT_STOP_MS || waiting
        ? index
        : positionAt(offsets, offsets[index] - waitMs / 60_000, index);
    buses.push({
      uid,
      position,
      next: index,
      waitMs,
      waiting,
      delayed: departure.Pred === InTimeStatus.Delayed,
      departure,
    });
  }
  return buses.sort((a, b) => b.position - a.position);
}
