"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { useNow } from "~/hooks/use-now";
import { useI18n } from "~/i18n/i18n-provider";
import type { StationDeparture } from "~/journey/models";
import { formatDeparture } from "~/lib/format";
import { cn } from "~/lib/utils";
import { delayMs, expected, formatTime } from "~/timer/journey";
import { fetcher } from "~/utils/fetcher";

const ROWS = 5;
// A bus at the stop right now is still shown
const LEFT_MS = 30_000;

// The next departures of every operator and means, soonest first
function nextDepartures(
  departures: ReadonlyArray<StationDeparture>,
  now: number
): ReadonlyArray<StationDeparture> {
  return departures
    .filter((departure) => expected(departure.departure) >= now - LEFT_MS)
    .sort((a, b) => expected(a.departure) - expected(b.departure))
    .slice(0, ROWS);
}

// A stop on the map as the electronic departure board at the stop: amber
// lights on black, the next departures from transport.opendata.ch
export function DepartureBoard({
  name,
  subtitle,
  code,
  href,
  onPlan,
}: {
  name: string;
  subtitle?: string;
  // National stop code: without it, no departures nor journeys
  code?: string;
  // The departures page of the TPL stops
  href?: string;
  onPlan: () => void;
}) {
  const now = useNow();
  const { m } = useI18n();
  const { data, error } = useSWR<ReadonlyArray<StationDeparture>>(
    code ? `/api/journey/stationboard?id=${code}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  );
  const departures = data && nextDepartures(data, now);

  return (
    <div className="w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg bg-[#0d0d0d] font-mono text-[#ffb000] shadow-xl ring-1 ring-black/60 [text-shadow:0_0_6px_rgba(255,176,0,0.45)]">
      <div className="flex items-start justify-between gap-3 border-b border-[#ffb000]/25 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold uppercase tracking-wider">{name}</p>
          {subtitle && <p className="truncate text-[11px] text-[#ffb000]/60">{subtitle}</p>}
        </div>
        {now > 0 && <span className="shrink-0 text-sm tabular-nums">{formatTime(now)}</span>}
      </div>

      {code && (
        <ul className="py-1 text-[13px] uppercase">
          {departures === undefined ? (
            <BoardMessage pulse={error === undefined}>
              {error === undefined ? m.map.loading : m.map.unavailable}
            </BoardMessage>
          ) : departures.length === 0 ? (
            <BoardMessage>{m.stops.noDepartures}</BoardMessage>
          ) : (
            departures.map((departure) => (
              <BoardRow
                key={`${departure.trip}-${departure.departure.scheduled}`}
                departure={departure}
                now={now}
              />
            ))
          )}
        </ul>
      )}

      <div className="flex items-center gap-4 border-t border-[#ffb000]/25 px-3 py-2 text-xs font-semibold">
        {href && (
          <Link href={href} className="flex items-center hover:text-[#ffd060]">
            {m.map.departures}
            <ChevronRight className="size-3.5" />
          </Link>
        )}
        {code && (
          <button type="button" onClick={onPlan} className="flex items-center hover:text-[#ffd060]">
            {m.common.journeyFromHere}
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function BoardRow({ departure, now }: { departure: StationDeparture; now: number }) {
  const { m } = useI18n();
  const at = expected(departure.departure);
  const ms = at - now;
  const delay = Math.round(delayMs(departure.departure) / 60_000);

  return (
    <li className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2 px-3 py-1 odd:bg-white/[0.03]">
      <span className="truncate rounded-[2px] border border-[#ffb000]/50 px-1 text-center text-xs font-bold leading-5">
        {departure.line}
      </span>
      <span className="truncate">{departure.destination}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        {delay > 0 && <span className="text-[#ff5a36] [text-shadow:0_0_6px_rgba(255,90,54,0.5)]">+{delay}′</span>}
        <span className={cn(now > 0 && ms < 2 * 60_000 && "animate-pulse")}>
          {now > 0 ? formatDeparture(m, ms, formatTime(at)) : formatTime(at)}
        </span>
      </span>
    </li>
  );
}

function BoardMessage({ children, pulse }: { children: React.ReactNode; pulse?: boolean }) {
  return (
    <li className={cn("px-3 py-3 text-center text-[#ffb000]/70", pulse && "animate-pulse")}>
      {children}
    </li>
  );
}
