// Links the legs planned with transport.opendata.ch to the TPL real-time
// server: TPL stops carry the national stop code used by opendata, and a
// planned bus is found among the departures of its stop by line and time.
import type { Coordinates, Departure, Target } from "~/timetable/models";
import { expected, formatTime, type Timing } from "~/timer/journey";
import { distanceMeters, type Position } from "~/timer/plan";
import type { PlannedLeg, StationDeparture } from "./models";

// Planned buses farther than this from the real-time departure are another run
const MATCH_TOLERANCE_MS = 15 * 60_000;
// The real-time estimate may run this much ahead of the timetable
const EARLY_MS = 2 * 60_000;

// Bus categories of the timetable: plain, night, low floor, minibus, express
const BUSES = new Set(["B", "BN", "BUS", "NFB", "KB", "EXB"]);
// A departure of the forecast minute may still be at the stop
const LEFT_MS = 60_000;

export function isTplLeg(leg: Pick<PlannedLeg, "operator">): boolean {
  return leg.operator?.toUpperCase() === "TPL";
}

// The TPL stop of a national stop code
export function tplStop(
  targets: ReadonlyArray<Target> | undefined,
  stationId: string
): Target | undefined {
  return targets?.find((target) => target.CodeNat === stationId);
}

// The platform closest to `position`, the first one without a position
export function closestPlatform(
  stop: Target,
  position: Position | undefined
): Coordinates | undefined {
  if (position === undefined) return stop.Coordinates[0];
  let best: Coordinates | undefined;
  let bestMeters = Number.POSITIVE_INFINITY;
  for (const platform of stop.Coordinates) {
    const meters = distanceMeters(position, { lat: platform.Lat, lon: platform.Lon });
    if (meters < bestMeters) {
      best = platform;
      bestMeters = meters;
    }
  }
  return best;
}

const sameLine = (a: string, b: string) =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

// The real-time departure of a planned bus: same line and timetable time,
// otherwise the closest to the expected time. A bus does not leave before
// its time: an earlier run is the previous bus, not the planned one, still
// to appear in the real-time data.
export function findLegDeparture(
  departures: ReadonlyArray<Departure>,
  line: string,
  timing: Timing,
  toleranceMs = MATCH_TOLERANCE_MS
): (Departure & { readonly DepartureAt: number }) | undefined {
  const at = expected(timing);
  const clock = formatTime(timing.scheduled);
  let best: (Departure & { readonly DepartureAt: number }) | undefined;
  let bestOnTime = false;
  for (const departure of departures) {
    const { DepartureAt } = departure;
    if (DepartureAt === undefined || !sameLine(departure.RouteCode, line)) {
      continue;
    }
    if (DepartureAt < timing.scheduled - EARLY_MS) continue;
    if (Math.abs(DepartureAt - at) > toleranceMs) continue;
    const onTime = departure.Time === clock;
    if (bestOnTime && !onTime) continue;
    if (
      best === undefined ||
      (onTime && !bestOnTime) ||
      Math.abs(DepartureAt - at) < Math.abs(best.DepartureAt - at)
    ) {
      best = { ...departure, DepartureAt };
      bestOnTime = onTime;
    }
  }
  return best;
}

// The departures of a TPL stop from transport.opendata.ch, standing in for
// the real-time list while the TPL server is down. The station also lists
// the trains and the buses of other operators passing by: only the buses
// are kept, and only those of TPL when there are any, as in the real-time
// list. Soonest first, without the buses already gone.
export function tplBoard(
  departures: ReadonlyArray<StationDeparture>,
  now: number
): ReadonlyArray<StationDeparture> {
  const buses = departures.filter(
    (departure) =>
      BUSES.has(departure.category.toUpperCase()) &&
      expected(departure.departure) >= now - LEFT_MS
  );
  const tpl = buses.filter(isTplLeg);
  return (tpl.length > 0 ? tpl : buses).sort(
    (a, b) => expected(a.departure) - expected(b.departure)
  );
}
