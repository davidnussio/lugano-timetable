"use client";

import dynamic from "next/dynamic";

// MapLibre needs the browser (WebGL) and is large: load it only on this page
export const StopsMap = dynamic(
  () => import("./stops-map").then((module) => module.StopsMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-muted" />,
  }
);
