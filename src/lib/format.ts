import type { Messages } from "~/i18n/messages";
import { minutesLeft, type WeatherDelay } from "~/timer/plan";

// "7 min", "ora" or the clock time when the departure is more than an hour away
export function formatDeparture(m: Messages, ms: number, time: string): string {
  if (ms < 60_000) return m.format.now;
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

// "350 m", "1,2 km"
export function formatDistance(m: Messages, meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${m.format.decimal(meters / 1000)} km`;
}

// "4,8 km/h", from meters per second
export function formatSpeed(m: Messages, metersPerSecond: number): string {
  return `${m.format.decimal(metersPerSecond * 3.6)} km/h`;
}

// Below this a climb is within the error of the heights: not worth showing
const MIN_CLIMB_SHOWN = 5;

// "↑ 35 m" for a walk going up, undefined when flat or downhill
export function formatClimb(climb: number | undefined): string | undefined {
  return climb !== undefined && climb >= MIN_CLIMB_SHOWN ? `↑ ${Math.round(climb)} m` : undefined;
}

// "Pioggia +2 min" for what the weather adds to a walk
export function formatWeather(
  m: Messages,
  weather: WeatherDelay | undefined
): string | undefined {
  return weather && `${m.weather[weather.kind]} +${weather.minutes} min`;
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

// The stop without its town, short enough for a chip: "Lugano, Via
// Brentani" → "Via Brentani", "Bellinzona" as it is
export function stopName(label: string): string {
  return label.split(", ").at(-1) ?? label;
}

// Town of a stop label: "Lugano, Bellavista" → "Lugano"
export function town(label: string): string {
  return label.split(",")[0].trim();
}

// The towns of a journey, each under its stop, saying nothing twice: none
// for a stop named as its town ("Bellinzona"), only the first for a journey
// within a town. "Bellinzona" → "Lugano, Via Brentani": Lugano under the
// destination.
export function journeyTowns(
  from: string,
  to: string
): { readonly from?: string; readonly to?: string } {
  const own = (label: string) => (town(label) === stopName(label) ? undefined : town(label));
  const fromTown = own(from);
  const toTown = own(to);
  return {
    ...(fromTown === undefined ? {} : { from: fromTown }),
    ...(toTown === undefined || toTown === town(from) ? {} : { to: toTown }),
  };
}
