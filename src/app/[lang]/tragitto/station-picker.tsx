"use client";

import { Bus, LocateFixed, MapPin, Ship, Star, TrainFront } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useGeolocation } from "~/hooks/use-geolocation";
import { useI18n } from "~/i18n/i18n-provider";
import { formatDistance } from "~/lib/format";
import type { Station } from "~/journey/models";
import { fetcher } from "~/utils/fetcher";

const MIN_QUERY = 2;

// Search when the user pauses typing, not at every character
const SEARCH_DELAY_MS = 250;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

function StationIcon({ icon }: { icon: string | undefined }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (icon === "train") return <TrainFront className={className} />;
  if (icon === "ship") return <Ship className={className} />;
  if (icon === "bus") return <Bus className={className} />;
  return <MapPin className={className} />;
}

// Suggestions while typing a stop: search results, stops nearby or the
// favorite stops
export function StationPicker({
  query,
  nearby,
  favorites,
  onPick,
}: {
  query: string;
  nearby: boolean;
  favorites: ReadonlyArray<Station>;
  onPick: (station: Station) => void;
}) {
  const { m } = useI18n();
  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY;
  const search = useDebounced(trimmed, SEARCH_DELAY_MS);
  // Still typing: the request for the current text has not started yet
  const typing = searching && search !== trimmed;
  const { position, error } = useGeolocation(nearby && !searching);
  const key = searching
    ? search.length >= MIN_QUERY
      ? `/api/journey/stations?${new URLSearchParams({ query: search })}`
      : null
    : nearby && position
      ? // Rounded: nearby stops do not change every few meters
        `/api/journey/stations?lat=${position.lat.toFixed(4)}&lon=${position.lon.toFixed(4)}`
      : null;
  const { data, error: requestError, isLoading } = useSWR<ReadonlyArray<Station>>(
    key,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const stations = key === null ? (searching ? [] : favorites) : (data ?? []);
  const title = searching
    ? undefined
    : nearby
      ? m.journey.nearYou
      : favorites.length > 0
        ? m.journey.favoriteStops
        : undefined;
  const status =
    nearby && !searching && error
      ? error === "denied"
        ? m.common.locationDenied
        : m.common.locationUnavailable
      : requestError
        ? m.journey.searchUnavailable
        : nearby && !searching && !position
          ? m.common.locating
          : (typing || isLoading) && stations.length === 0
            ? m.journey.searching
            : key !== null && stations.length === 0
              ? m.journey.noStops
              : !searching && !nearby && favorites.length === 0
                ? m.journey.typeHint
                : undefined;

  return (
    <section className="px-4 pt-1">
      {title && (
        <h2 className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {nearby ? <LocateFixed className="size-3.5" /> : <Star className="size-3.5" />}
          {title}
        </h2>
      )}
      {status && <p className="px-1 py-3 text-sm text-muted-foreground">{status}</p>}
      {stations.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {stations.map((station) => (
            <li key={station.id}>
              <button
                type="button"
                onClick={() => onPick(station)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted">
                <StationIcon icon={station.icon} />
                <span className="min-w-0 flex-1 truncate font-medium">{station.name}</span>
                {station.distance !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDistance(station.distance)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
