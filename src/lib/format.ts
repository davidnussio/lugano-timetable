import { minutesLeft } from "~/timer/plan";

// "7 min", "ora" or the clock time when the departure is more than an hour away
export function formatDeparture(ms: number, time: string): string {
  if (ms < 60_000) return "ora";
  if (ms >= 60 * 60_000) return time;
  return `${minutesLeft(ms)} min`;
}

// "04:32", "1:02:10" (negative values are shown as "-00:30")
export function formatClock(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0
    ? `${sign}${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${sign}${pad(minutes)}:${pad(seconds)}`;
}

// "45 min", "1 h 06"
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${(minutes % 60).toString().padStart(2, "0")}`;
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

// "4,8 km/h", from meters per second
export function formatSpeed(metersPerSecond: number): string {
  return `${(metersPerSecond * 3.6).toFixed(1).replace(".", ",")} km/h`;
}

// Below this a climb is within the error of the heights: not worth showing
const MIN_CLIMB_SHOWN = 5;

// "↑ 35 m" for a walk going up, undefined when flat or downhill
export function formatClimb(climb: number | undefined): string | undefined {
  return climb !== undefined && climb >= MIN_CLIMB_SHOWN ? `↑ ${Math.round(climb)} m` : undefined;
}

// Minutes from `now` to an "HH:mm" time of the RTPI server (local time),
// assuming the nearest day: 23:58 → 00:03 is 5 minutes.
export function minutesUntilClock(time: string, now: Date): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (match === null) return undefined;
  const target = Number(match[1]) * 60 + Number(match[2]);
  const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let diff = target - current;
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff > 12 * 60) diff -= 24 * 60;
  return diff;
}

// Town of a stop label: "Lugano, Bellavista" → "Lugano"
export function town(label: string): string {
  return label.split(",")[0].trim();
}
