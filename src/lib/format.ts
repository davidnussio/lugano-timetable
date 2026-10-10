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

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
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
