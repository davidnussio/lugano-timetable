"use client";

import { ChevronDown, Clock } from "lucide-react";
import { useNow } from "~/hooks/use-now";
import { useI18n } from "~/i18n/i18n-provider";
import type { Locale } from "~/i18n/config";
import type { Messages } from "~/i18n/messages";
import {
  arrivalTime,
  NOW,
  SEARCH_DAYS,
  type SearchTime,
  searchAt,
  zurichAt,
  zurichTime,
} from "~/journey/when";
import { cn } from "~/lib/utils";

// The time of the search with its milliseconds, worked out once when chosen
export type ChosenTime = SearchTime & { readonly at: number | undefined };

export const NOW_CHOSEN: ChosenTime = { ...NOW, at: undefined };

export function chooseTime(time: SearchTime, now: number): ChosenTime {
  return { ...time, at: searchAt(time, now) };
}

const intlLocales: Record<Locale, string> = { it: "it-CH", de: "de-CH", en: "en-GB" };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function weekday(locale: Locale, ms: number): string {
  return capitalize(
    new Intl.DateTimeFormat(intlLocales[locale], {
      weekday: "short",
      timeZone: "Europe/Zurich",
    })
      .format(ms)
      .replace(".", "")
  );
}

function dayOfMonth(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Europe/Zurich" }).format(
    ms
  );
}

// "Partenza · adesso", "Arrivo entro · Domani 08:00", "Partenza · Ven 23 08:00"
function summary(m: Messages, locale: Locale, { day, time, arrive, at }: ChosenTime): string {
  const mode = arrive ? m.journey.arriveBy : m.journey.departAt;
  if (time === undefined && day === 0) return `${mode} · ${m.journey.whenNow}`;
  const clock = at === undefined ? time : zurichTime(at);
  const date =
    day === 0
      ? undefined
      : day === 1
        ? m.journey.tomorrow
        : at === undefined
          ? undefined
          : `${weekday(locale, at)} ${dayOfMonth(at)}`;
  return `${mode} · ${[date, clock].filter(Boolean).join(" ")}`;
}

// The time of the search, folded: opens the panel to change it
export function SearchTimeButton({
  value,
  open,
  onToggle,
}: {
  value: ChosenTime;
  open: boolean;
  onToggle: () => void;
}) {
  const { m, locale } = useI18n();
  const chosen = value.time !== undefined || value.day > 0 || value.arrive;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted",
        chosen ? "border-primary/60 text-primary" : "border-border"
      )}>
      <Clock className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{summary(m, locale, value)}</span>
      <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
  );
}

const segment = (selected: boolean) =>
  cn(
    "rounded-lg py-1.5 text-sm font-medium transition-colors",
    selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
  );

// Leave or arrive, one of the next seven days, and the time
export function SearchTimePanel({
  value,
  onChange,
}: {
  value: ChosenTime;
  onChange: (time: SearchTime) => void;
}) {
  const { m, locale } = useI18n();
  const now = useNow();
  if (now === 0) return null;

  // A day or arriving without a time: from the time of now, an hour later to
  // arrive
  const withTime = (next: SearchTime): SearchTime =>
    next.time !== undefined || (next.day === 0 && !next.arrive)
      ? next
      : { ...next, time: next.arrive ? arrivalTime(now) : zurichTime(now) };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([false, true] as const).map((arrive) => (
          <button
            key={String(arrive)}
            type="button"
            aria-pressed={value.arrive === arrive}
            onClick={() => onChange(withTime({ ...value, arrive }))}
            className={segment(value.arrive === arrive)}>
            {arrive ? m.journey.arrive : m.journey.leave}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: SEARCH_DAYS }, (_, day) => {
          const noon = zurichAt(day, "12:00", now) ?? now;
          const selected = value.day === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(withTime({ ...value, day }))}
              className={cn(
                "flex flex-col items-center rounded-xl py-1.5 transition-colors",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}>
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-[11px] font-medium",
                  !selected && "text-muted-foreground"
                )}>
                {day === 0 ? m.journey.today : weekday(locale, noon)}
              </span>
              <span className="text-base font-semibold tabular-nums">{dayOfMonth(noon)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted px-3">
          <span className="text-xs font-medium text-muted-foreground">{m.journey.time}</span>
          <input
            type="time"
            value={value.time ?? zurichTime(now)}
            onChange={(event) => {
              const time = event.target.value;
              if (time !== "") onChange({ ...value, time });
            }}
            className="min-w-0 flex-1 bg-transparent font-mono text-base tabular-nums outline-none [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <button
          type="button"
          disabled={value.time === undefined && value.day === 0 && !value.arrive}
          onClick={() => onChange(NOW)}
          className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-primary transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
          {m.journey.now}
        </button>
      </div>
    </div>
  );
}
