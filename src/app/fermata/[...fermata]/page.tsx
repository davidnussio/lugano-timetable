"use client";
import { use, useEffect, useState } from "react";

import { ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import Loading from "~/app/components/loading";
import { useFavorites } from "~/hooks/use-favorites";
import { InTimeStatus, type Itineraries } from "~/timetable/models";
import { shimmer } from "~/ui/utils/shimmer";
import { toBase64 } from "~/utils/base64";
import { fetcher } from "~/utils/fetcher";
import { getTargets } from "~/timetable/api";

type FermatePageProps = {
  params: Promise<{
    fermata: string[];
  }>;
};

function useItineraries(itineraries: string[]) {
  const url = `/api/timetable/itineraries?${itineraries
    .map((i) => `itineraries=${i}`)
    .join("&")}`;

  const { data, error, isLoading } = useSWR<Itineraries[]>(url, fetcher, {
    refreshInterval: 10_000,
  });

  return {
    data: data ?? [],
    isLoading,
    isError: error,
  };
}

const colors = [{ from: "#1E3A3A", via: "#2A4A4A", to: "#1E3A3A" }];

export default function FermatePage(props: FermatePageProps) {
  const params = use(props.params);
  const { data, isLoading } = useItineraries(params.fermata);
  const { isFavorite, toggleFavorite, isLoaded } = useFavorites();
  const [stopInfo, setStopInfo] = useState<{ name: string; label: string } | null>(null);

  // Load stop info for favorite functionality
  useEffect(() => {
    async function loadStopInfo() {
      const targets = await getTargets();
      const currentStop = targets.find(
        (t) => t.Identifiers.join(",") === params.fermata.join(",")
      );
      if (currentStop) {
        setStopInfo({ name: currentStop.Name, label: currentStop.Label });
      }
    }
    loadStopInfo();
  }, [params.fermata]);

  if (isLoading) return <Loading />;

  const currentIsFavorite = isLoaded && isFavorite(params.fermata);

  return (
    <div className="px-4 pb-4">
      {/* Favorite toggle button */}
      {stopInfo && (
        <div className="flex items-center justify-between py-3 mb-3 border-b border-border">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{stopInfo.name}</span>
            <span className="text-xs text-muted-foreground">{stopInfo.label}</span>
          </div>
          <button
            onClick={() =>
              toggleFavorite({
                name: stopInfo.name,
                label: stopInfo.label,
                identifiers: params.fermata,
              })
            }
            className="p-2.5 rounded-full hover:bg-muted transition-colors"
            aria-label={currentIsFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
            <Star
              className={`h-5 w-5 transition-colors ${
                currentIsFavorite ? "fill-accent text-accent" : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
      )}

      <ul role="list" className="divide-y divide-border rounded-xl overflow-hidden bg-card border border-border">
        {data.map((target) => (
          <li key={target.Routing} className="transition-colors hover:bg-muted">
            <Link
              className="flex items-center gap-3 px-4 py-3.5"
              href={`/routing/${target.Target}/${target.Route}/${target.Dir}/${target.Routing}`}>
              <div className="flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                <Image
                  src={`http://bs.tplsa.ch/images/routes/${target.Img.replace(
                    ".jpg",
                    ".png"
                  )}`}
                  alt={target.Img}
                  placeholder="blur"
                  width={44}
                  height={44}
                  blurDataURL={`data:image/svg+xml;base64,${toBase64(
                    shimmer(44, 44, colors[0])
                  )}`}
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{target.Dest}</span>
                  {target.Pred === InTimeStatus.Delayed && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex-shrink-0">
                      Ritardo
                    </span>
                  )}
                </div>
                <span className="text-sm font-mono text-muted-foreground">{target.Time}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </Link>
          </li>
        ))}
        {data.length === 0 && (
          <li className="px-4 py-8 text-center text-muted-foreground">
            Nessun collegamento disponibile
          </li>
        )}
      </ul>
    </div>
  );
}
