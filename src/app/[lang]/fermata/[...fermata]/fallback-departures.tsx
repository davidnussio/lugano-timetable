"use client";

import { Info } from "lucide-react";
import useSWR from "swr";
import { SkeletonList } from "~/app/components/skeleton-list";
import { TransportBadge } from "~/app/components/transport-badge";
import { useI18n } from "~/i18n/i18n-provider";
import type { StationDeparture } from "~/journey/models";
import { tplBoard } from "~/journey/tpl";
import { formatDeparture } from "~/lib/format";
import { cn } from "~/lib/utils";
import { delayMs, expected, formatTime } from "~/timer/journey";
import { fetcher } from "~/utils/fetcher";

export function ServiceUnavailable() {
  const { m } = useI18n();
  return (
    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
      {m.common.serviceUnavailable}
    </p>
  );
}

// The departures of the stop from transport.opendata.ch, while the TPL
// server is down. No timer bell: the timer follows its bus in the TPL data
// by trip id and routing, which these departures lack, and starting it as
// a journey would count down to the end of the line rather than to the bus.
export function FallbackDepartures({
  stationId,
  now,
}: {
  // National stop code of the stop
  stationId: string;
  now: number;
}) {
  const { m } = useI18n();
  const { data, error } = useSWR<ReadonlyArray<StationDeparture>>(
    `/api/journey/stationboard?id=${stationId}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  if (data === undefined) {
    return error === undefined ? <SkeletonList /> : <ServiceUnavailable />;
  }
  const departures = tplBoard(data, now);
  return (
    <>
      <p className="flex items-center gap-1.5 px-5 pb-1 text-xs text-muted-foreground">
        <Info className="size-3.5" />
        {m.stop.fallbackSource}
      </p>
      <ul role="list" className="space-y-2 px-4 pb-6 pt-2">
        {departures.map((departure) => (
          <FallbackRow
            key={`${departure.trip}-${departure.departure.scheduled}`}
            departure={departure}
            now={now}
          />
        ))}
        {departures.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {m.common.noDeparturesSoon}
          </li>
        )}
      </ul>
    </>
  );
}

// As the rows of the real-time list, without the link to the route of the
// bus (unknown here) and with the minutes of delay
function FallbackRow({
  departure,
  now,
}: {
  departure: StationDeparture;
  now: number;
}) {
  const { m } = useI18n();
  const at = expected(departure.departure);
  const ms = now > 0 ? at - now : undefined;
  const imminent = ms !== undefined && ms < 2 * 60_000;
  const delay = Math.round(delayMs(departure.departure) / 60_000);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <TransportBadge
        line={departure.line}
        category={departure.category}
        operator={departure.operator}
        size={44}
        className="rounded-xl"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{departure.destination}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            {formatTime(departure.departure.scheduled)}
          </span>
          {delay > 0 && (
            <span className="rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">
              {m.common.delayMinutes(delay)}
            </span>
          )}
          {departure.platform && <span>{m.stop.platform(departure.platform)}</span>}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        {ms !== undefined ? (
          <span
            className={cn(
              "text-xl font-bold tabular-nums leading-none",
              imminent ? "text-warning" : "text-foreground"
            )}>
            {formatDeparture(ms, formatTime(at))}
          </span>
        ) : (
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatTime(at)}
          </span>
        )}
      </div>
    </li>
  );
}
