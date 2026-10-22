"use client";

import { ChartColumn, Download, Timer, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StopsHeader } from "~/app/components/stops-header";
import { historyStore, useHistory } from "~/history/store";
import {
  choices,
  delaySummary,
  type DelaySummary,
  groupBy,
  type HistoryFilter,
  historyTotals,
  rideSamples,
  type TimeOfDay,
  timeOfDay,
  type TripWeatherKind,
  type WeatherFilter,
  weatherOf,
} from "~/history/query";
import type { TripRecord } from "~/history/trip";
import { validTrips } from "~/history/valid";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
import { formatDelay, formatDistance, formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { DayType } from "~/timetable/reliability";
import { ClearHistory } from "./clear-dialog";
import { Breakdown, TripList } from "./trip-list";

const WEATHERS: ReadonlyArray<WeatherFilter> = ["dry", "wet", "rain", "heavyRain", "snow", "ice"];
const GROUPED_WEATHERS: ReadonlyArray<TripWeatherKind> = ["dry", "rain", "heavyRain", "snow", "ice"];
const DAYS: ReadonlyArray<DayType> = ["weekday", "saturday", "sunday"];
const TIMES: ReadonlyArray<TimeOfDay> = ["night", "morning", "day", "evening", "late"];

const iconButton =
  "grid size-10 place-items-center rounded-full transition-colors hover:bg-muted active:bg-muted";

// "lugo-storico-2026-10-22.json"
function download(trips: ReadonlyArray<TripRecord>) {
  const blob = new Blob(
    [JSON.stringify({ app: "LuGo", version: 1, exportedAt: Date.now(), trips }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lugo-storico-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// The trips of an export, or a bare list of trips
async function readTrips(file: File): Promise<ReadonlyArray<TripRecord>> {
  try {
    const value: unknown = JSON.parse(await file.text());
    return validTrips(
      typeof value === "object" && value !== null && "trips" in value ? value.trips : value
    );
  } catch {
    return [];
  }
}

// The history of the trips done with the timer, and the questions to ask it:
// how late a line leaves a stop in some weather, on some days, at some hour
export default function HistoryPage() {
  const { m } = useI18n();
  const history = useHistory();
  const [filter, setFilter] = useState<HistoryFilter>({});
  const [notice, setNotice] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const trips = useMemo(() => history ?? [], [history]);

  const importFile = async (chosen: File | undefined) => {
    if (chosen === undefined) return;
    const imported = await readTrips(chosen);
    if (imported.length > 0) historyStore.merge(imported);
    setNotice(imported.length > 0 ? m.history.imported(imported.length) : m.history.importFailed);
  };

  const clear = () => {
    historyStore.clear();
    setFilter({});
  };

  return (
    <main className="flex flex-1 flex-col">
      <StopsHeader title={m.history.title} current="/storico" />
      {/* How many trips, and what to do with them */}
      <div className="flex items-center gap-1 px-4">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {history && history.length > 0 ? m.history.count(history.length) : null}
        </p>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label={m.history.import}
          title={m.history.import}
          className={iconButton}
          onClick={() => file.current?.click()}>
          <Upload className="size-5" />
        </button>
        {trips.length > 0 && (
          <>
            <button
              type="button"
              aria-label={m.history.export}
              title={m.history.export}
              className={iconButton}
              onClick={() => download(trips)}>
              <Download className="size-5" />
            </button>
            <ClearHistory
              trips={trips.length}
              className={cn(iconButton, "text-destructive hover:bg-destructive/10")}
              onClear={clear}
            />
          </>
        )}
      </div>
      {notice && (
        <p role="status" className="mx-4 mt-3 rounded-xl bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {history === null ? null : trips.length === 0 ? (
        <Empty m={m} />
      ) : (
        <HistoryView trips={trips} filter={filter} onFilter={setFilter} />
      )}
    </main>
  );
}

function Empty({ m }: { m: Messages }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-24 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-muted">
        <ChartColumn className="size-7 text-muted-foreground" />
      </span>
      <h2 className="text-lg font-semibold">{m.history.empty}</h2>
      <p className="text-sm text-muted-foreground">{m.history.emptyHint}</p>
      <Link
        href="/timer"
        className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
        <Timer className="size-4" />
        {m.timer.title}
      </Link>
    </div>
  );
}

function HistoryView({
  trips,
  filter,
  onFilter,
}: {
  trips: ReadonlyArray<TripRecord>;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
}) {
  const { m } = useI18n();
  const totals = useMemo(() => historyTotals(trips), [trips]);
  // The lines from the stop chosen, the stops of the line chosen
  const lines = useMemo(
    () => choices(rideSamples(trips, { stop: filter.stop }).map((sample) => sample.ride.line)),
    [trips, filter.stop]
  );
  const stops = useMemo(
    () => choices(rideSamples(trips, { line: filter.line }).map((sample) => sample.ride.from)),
    [trips, filter.line]
  );
  const samples = useMemo(() => rideSamples(trips, filter), [trips, filter]);
  const summary = useMemo(() => delaySummary(samples), [samples]);
  // Each breakdown with the other questions kept: the weather of the 6 at
  // Via Brentani on weekday mornings
  const byWeather = useMemo(
    () =>
      groupBy(rideSamples(trips, { ...filter, weather: undefined }), GROUPED_WEATHERS, (sample) =>
        weatherOf(sample.trip)
      ),
    [trips, filter]
  );
  const byDay = useMemo(
    () =>
      groupBy(rideSamples(trips, { ...filter, day: undefined }), DAYS, (sample) => sample.trip.dayType),
    [trips, filter]
  );
  const byTime = useMemo(
    () =>
      groupBy(rideSamples(trips, { ...filter, time: undefined }), TIMES, (sample) =>
        timeOfDay(sample.hour)
      ),
    [trips, filter]
  );

  const set = <K extends keyof HistoryFilter>(key: K, value: HistoryFilter[K] | "") =>
    onFilter({ ...filter, [key]: value === "" ? undefined : value });

  return (
    <div className="space-y-4 px-4 py-4">
      <section className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
        <Total label={m.history.totals.trips} value={totals.trips.toString()} />
        <Total label={m.history.totals.onBoard} value={formatDuration(totals.rideMs)} />
        <Total label={m.history.totals.walked} value={formatDistance(m, totals.walkMeters)} />
        <Total label={m.history.totals.waited} value={formatDuration(totals.waitMs)} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{m.history.ask}</h2>
          <p className="text-xs text-muted-foreground">{m.history.askHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label={m.history.filters.line}
            value={filter.line}
            any={m.history.anyLine}
            options={lines.map((line) => [line, m.common.line(line)])}
            onChange={(value) => set("line", value)}
          />
          <Select
            label={m.history.filters.stop}
            value={filter.stop}
            any={m.history.anyStop}
            options={stops.map((stop) => [stop, stop])}
            onChange={(value) => set("stop", value)}
          />
          <Select
            label={m.history.filters.weather}
            value={filter.weather}
            any={m.history.anyWeather}
            options={WEATHERS.map((weather) => [weather, m.history.weathers[weather]])}
            onChange={(value) => set("weather", value as WeatherFilter | "")}
          />
          <Select
            label={m.history.filters.day}
            value={filter.day}
            any={m.history.anyDay}
            options={DAYS.map((day) => [day, m.history.days[day]])}
            onChange={(value) => set("day", value as DayType | "")}
          />
          <Select
            label={m.history.filters.time}
            value={filter.time}
            any={m.history.anyTime}
            options={TIMES.map((time) => [time, m.history.times[time]])}
            onChange={(value) => set("time", value as TimeOfDay | "")}
            className="col-span-2"
          />
        </div>
        <Answer summary={summary} />
      </section>

      <Breakdown
        title={m.history.byWeather}
        groups={byWeather}
        label={(key) => m.history.weathers[key]}
        current={filter.weather}
      />
      <Breakdown
        title={m.history.byDay}
        groups={byDay}
        label={(key) => m.history.days[key]}
        current={filter.day}
      />
      <Breakdown
        title={m.history.byTime}
        groups={byTime}
        label={(key) => m.history.times[key]}
        current={filter.time}
      />

      <TripList samples={samples} />
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-base font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Select({
  label,
  value,
  any,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string | undefined;
  any: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 w-full min-w-0 truncate rounded-xl border border-border bg-background px-2 text-sm",
          value !== undefined && "border-primary text-primary"
        )}>
        <option value="">{any}</option>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

const share = (value: number) => `${Math.round(value * 100)}%`;

// What the history says to the question: the usual delay first, then the
// numbers behind it
function Answer({ summary }: { summary: DelaySummary }) {
  const { m } = useI18n();
  if (summary.rides === 0) {
    return <p className="rounded-xl bg-muted px-3 py-3 text-sm">{m.history.noRides}</p>;
  }
  const { median, mean, p80, max, lateShare, onTimeShare } = summary;
  if (median === undefined || mean === undefined || p80 === undefined || max === undefined) {
    return (
      <p className="rounded-xl bg-muted px-3 py-3 text-sm">
        {m.history.noDelay} · {m.history.rides(summary.rides)}
      </p>
    );
  }
  const minutes = Math.round(median / 60_000);
  const headline =
    minutes > 0
      ? m.reliability.late(minutes)
      : minutes < 0
        ? m.reliability.early(-minutes)
        : m.reliability.onTime;
  return (
    <div className="space-y-3 rounded-xl bg-primary/10 px-3 py-3">
      <div>
        <p className="text-lg font-semibold leading-tight text-primary">{headline}</p>
        <p className="text-xs text-muted-foreground">
          {m.history.measured(summary.measured, summary.rides)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat label={m.history.mean} value={formatDelay(m, mean, true)} />
        <Stat label={m.history.p80} value={formatDelay(m, p80)} />
        <Stat label={m.history.worst} value={formatDelay(m, max)} />
        {onTimeShare !== undefined && <Stat label={m.history.onTime} value={share(onTimeShare)} />}
        {lateShare !== undefined && <Stat label={m.history.late} value={share(lateShare)} />}
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
