"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import Loading from "~/app/components/loading";
import { InTimeStatus, type Itineraries } from "~/timetable/models";
import { shimmer } from "~/ui/utils/shimmer";
import { toBase64 } from "~/utils/base64";
import { fetcher } from "~/utils/fetcher";

type FermatePageProps = {
  params: {
    fermata: string[];
  };
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

const colors = [{ from: "#300", via: "#333", to: "#300" }];

export default function FermatePage({ params }: FermatePageProps) {
  const { data, isLoading } = useItineraries(params.fermata);

  if (isLoading) return <Loading />;

  return (
    <div>
      <ul role="list" className="divide-y divide-gray-200 border rounded-lg">
        {data.map((target) => (
          <li key={target.Routing} className="px-4 py-2">
            {/* Target, Route, Dir, Routing */}
            <Link
              className="flex space-x-2 items-center justify-between"
              href={`/routing/${target.Target}/${target.Route}/${target.Dir}/${target.Routing}`}>
              <div className="flex-shrink">
                <Image
                  src={`http://bs.tplsa.ch/images/routes/${target.Img.replace(
                    ".jpg",
                    ".png"
                  )}`}
                  alt={target.Img}
                  placeholder="blur"
                  width={40}
                  height={40}
                  blurDataURL={`data:image/svg+xml;base64,${toBase64(
                    shimmer(40, 40, colors[0])
                  )}`}
                />
              </div>
              <div className="flex flex-grow flex-col items-start">
                <div className="flex w-full">
                  {target.Dest}
                  <div className="flex-grow" />
                  {target.Pred === InTimeStatus.Delayed && (
                    <span className="text-red-500 text-sm font-medium">
                      Ritardo
                    </span>
                  )}
                </div>
                <div className="text-xs font-light">{target.Time} </div>
              </div>
              <div>
                <ChevronRight />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
