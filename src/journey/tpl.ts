// Links the legs planned with transport.opendata.ch to the TPL real-time
// server: TPL stops carry the national stop code used by opendata, and a
// planned bus is found among the departures of its stop by line and time.
import type { Coordinates, Departure, Target } from "~/timetable/models";
import { distanceMeters, type Position } from "~/timer/plan";
import type { PlannedLeg } from "./models";

// Planned buses farther than this from the real-time departure are another run
const MATCH_TOLERANCE_MS = 15 * 60_000;

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

// The real-time departure of a planned bus: same line, the closest to the
// expected time
export function findLegDeparture(
  departures: ReadonlyArray<Departure>,
  line: string,
  at: number,
  toleranceMs = MATCH_TOLERANCE_MS
): (Departure & { readonly DepartureAt: number }) | undefined {
  let best: (Departure & { readonly DepartureAt: number }) | undefined;
  for (const departure of departures) {
    const { DepartureAt } = departure;
    if (DepartureAt === undefined || !sameLine(departure.RouteCode, line)) {
      continue;
    }
    if (Math.abs(DepartureAt - at) > toleranceMs) continue;
    if (
      best === undefined ||
      Math.abs(DepartureAt - at) < Math.abs(best.DepartureAt - at)
    ) {
      best = { ...departure, DepartureAt };
    }
  }
  return best;
}
