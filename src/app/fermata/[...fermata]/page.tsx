"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import type { Itineraries } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";
import LoadingPage from "./loading";

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

const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#333" offset="20%" />
      <stop stop-color="#222" offset="50%" />
      <stop stop-color="#333" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#333" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(str);

export default function FermatePage({ params }: FermatePageProps) {
  const { data, isLoading } = useItineraries(params.fermata);
  console.log(data);

  if (isLoading) return <LoadingPage />;

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
                    shimmer(700, 475)
                  )}`}
                />
              </div>
              <div className="flex flex-grow flex-col items-start">
                {target.Dest}
                <div className="text-xs font-light">{target.Time}</div>
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
