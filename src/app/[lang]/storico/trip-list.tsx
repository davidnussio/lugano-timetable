"use client";

import { ArrowRight, CloudRain, CloudRainWind, CloudSnow, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { TransportBadge } from "~/app/components/transport-badge";
import type { Locale } from "~/i18n/config";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
import {
  departureDelay,
  type Group,
  type RideSample,
  sampleTrips,
  type TripWeatherKind,
  weatherOf,
} from "~/history/query";
import type { RideRecord, TripRecord } from "~/history/trip";
import { formatDelay, formatDistance, formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";

// The delays of each group side by side: the bar is the usual delay, the
// latest one the longest
export function Breakdown<K extends string>({
  title,
  groups,
  label,
  current,
}: {
  title: string;
  groups: ReadonlyArray<Group<K>>;
  label: (key: K) => string;
  current: string | undefined;
}) {
  const { m } = useI18n();
  const measured = groups.filter((group) => group.summary.median !== undefined);
  // One group alone compares with nothing
  if (measured.length < 2) return null;
  const longest = Math.max(60_000, ...measured.map((group) => Math.abs(group.summary.median ?? 0)));
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-2.5">
        {measured.map(({ key, summary }) => {
          const median = summary.median ?? 0;
          // Colored as written: "+2 min" is not yet late
          const minutes = Math.round(median / 60_000);
          return (
            <li key={key} className={cn(current !== undefined && current !== key && "opacity-50")}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{label(key)}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatDelay(m, median)}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {m.history.rides(summary.measured)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    minutes > 2 ? "bg-destructive" : minutes > 0 ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${Math.max(4, (Math.abs(median) / longest) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const intlLocales: Record<Locale, string> = { it: "it-CH", de: "de-CH", en: "en-GB" };

// "gio 15 gen, 08:13" in Lugano
function when(locale: Locale, ms: number): string {
  return new Intl.DateTimeFormat(intlLocales[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(ms);
}

const WEATHER_ICONS: Record<TripWeatherKind, typeof Sun> = {
  dry: Sun,
  rain: CloudRain,
  heavyRain: CloudRainWind,
  snow: CloudSnow,
  ice: Snowflake,
};

function delayText(m: Messages, ride: RideRecord): string | undefined {
  const delay = departureDelay(ride);
  if (delay === undefined) return undefined;
  const minutes = Math.round(delay / 60_000);
  return minutes > 0
    ? m.timer.departedLate(minutes)
    : minutes < 0
      ? m.timer.departedEarly(-minutes)
      : m.timer.onTime;
}

const PAGE = 20;

// The trips of the question, latest first
export function TripList({ samples }: { samples: ReadonlyArray<RideSample> }) {
  const { m } = useI18n();
  const [shown, setShown] = useState(PAGE);
  const trips = sampleTrips(samples);
  if (trips.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold">{m.history.trips}</h2>
      <ol className="space-y-2">
        {trips.slice(0, shown).map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </ol>
      {trips.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="h-10 w-full rounded-xl border border-border bg-card text-sm font-semibold transition-colors hover:bg-muted">
          {m.history.showMore}
        </button>
      )}
    </section>
  );
}

function TripCard({ trip }: { trip: TripRecord }) {
  const { m, locale } = useI18n();
  const weather = weatherOf(trip);
  const WeatherIcon = weather === undefined ? undefined : WEATHER_ICONS[weather];
  const departedAt = trip.rides[0].departure.actual ?? trip.rides[0].departure.scheduled ?? trip.startedAt;
  const details = [
    formatDuration(trip.durationMs),
    trip.walk?.meters === undefined ? undefined : formatDistance(m, trip.walk.meters),
    trip.completed ? undefined : m.history.stopped,
  ].filter(Boolean);

  return (
    <li className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <time className="tabular-nums">{when(locale, departedAt)}</time>
        {WeatherIcon && weather && (
          <span className="inline-flex items-center gap-1">
            <WeatherIcon aria-hidden className="size-3.5" />
            {m.history.weathers[weather]}
          </span>
        )}
        <span className="ml-auto shrink-0">{details.join(" · ")}</span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
        <span className="truncate">{trip.from}</span>
        <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{trip.to}</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {trip.rides.map((ride, index) => {
          const delay = delayText(m, ride);
          return (
            <li key={`${index}-${ride.line}`} className="flex items-center gap-1.5 text-xs">
              <TransportBadge
                line={ride.line}
                category={ride.category ?? "B"}
                operator={ride.operator ?? "TPL"}
                size={22}
              />
              {delay && <span className="text-muted-foreground">{delay}</span>}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
