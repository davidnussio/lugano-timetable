// Pure logic behind the departure timer: how long it takes to walk to the
// stop, when to leave and when to alert. Kept free of browser APIs so that it
// can be unit tested.

export interface Position {
  readonly lat: number;
  readonly lon: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

// Great-circle distance between two WGS84 positions
export function distanceMeters(a: Position, b: Position): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export type Pace = "slow" | "normal" | "fast";

// Walking speeds in meters per second
export const PACE_SPEED: Record<Pace, number> = {
  slow: 1.0,
  normal: 1.3,
  fast: 1.7,
};

// Streets are never a straight line, especially on Lugano's hills
const DETOUR_FACTOR = 1.35;

export function walkingSeconds(meters: number, pace: Pace = "normal"): number {
  return (meters * DETOUR_FACTOR) / PACE_SPEED[pace];
}

// Remaining minutes at which to alert, in descending order. Each alert comes
// after 40% of the remaining time has elapsed, so a 20 minute wait gives
// 12, 7, 4, 3, 2, 1, 0 instead of an alert every minute. 0 is "leave now".
export function alertThresholds(minutes: number, ratio = 0.6): number[] {
  const thresholds: number[] = [];
  let next = minutes * ratio;
  while (next >= 1) {
    const rounded = Math.round(next);
    if (rounded < minutes && !thresholds.includes(rounded)) {
      thresholds.push(rounded);
    }
    next *= ratio;
  }
  if (minutes > 1 && !thresholds.includes(1)) thresholds.push(1);
  thresholds.push(0);
  return thresholds;
}

// The alert to show now, if any: the smallest threshold already reached that
// has not been fired yet. Older thresholds reached at the same time (e.g.
// after the phone was asleep) are skipped, so only one alert is shown.
export function dueAlert(
  thresholds: ReadonlyArray<number>,
  fired: ReadonlyArray<number>,
  remainingMinutes: number
): number | undefined {
  const reached = thresholds.filter(
    (threshold) => remainingMinutes <= threshold
  );
  const smallest = reached.at(-1);
  if (smallest === undefined || fired.includes(smallest)) return undefined;
  return fired.some((threshold) => threshold < smallest) ? undefined : smallest;
}

export interface Countdown {
  // Until the bus leaves the stop
  readonly departureMs: number;
  // Until the user has to leave to catch it: negative when late. Equal to
  // `departureMs` when the walking time is not known.
  readonly leaveMs: number;
  readonly walkingMs: number | undefined;
}

export function countdown(
  departureAt: number,
  now: number,
  walkSeconds: number | undefined
): Countdown {
  const departureMs = departureAt - now;
  const walkingMs = walkSeconds === undefined ? undefined : walkSeconds * 1000;
  return {
    departureMs,
    leaveMs: departureMs - (walkingMs ?? 0),
    walkingMs,
  };
}

// Minutes shown to the user, rounded up so that an alert fired when 3
// minutes are left reads "3 min" (and 30 seconds read "1 min")
export function minutesLeft(ms: number): number {
  return Math.ceil(ms / 60_000) || 0;
}

export interface AlertMessage {
  readonly title: string;
  readonly body: string;
}

export function alertMessage(
  line: string,
  destination: string,
  { departureMs, leaveMs, walkingMs }: Countdown
): AlertMessage {
  const bus = `Linea ${line} per ${destination}`;
  const departs = minutesLeft(departureMs);
  const departsIn =
    departs <= 0 ? "Il bus sta arrivando" : `Il bus parte tra ${departs} min`;

  if (walkingMs === undefined) {
    return { title: departsIn, body: bus };
  }

  const leave = minutesLeft(leaveMs);
  const walk = Math.max(1, Math.round(walkingMs / 60_000));
  if (leave > 0) {
    return {
      title: `Esci tra ${leave} min`,
      body: `${bus} · ${departsIn.toLowerCase()}, ${walk} min a piedi`,
    };
  }
  if (leave === 0) {
    return {
      title: "Esci ora",
      body: `${bus} · ${departsIn.toLowerCase()}, ${walk} min a piedi`,
    };
  }
  return {
    title: `In ritardo di ${-leave} min: affrettati!`,
    body: `${bus} · ${departsIn.toLowerCase()}`,
  };
}
