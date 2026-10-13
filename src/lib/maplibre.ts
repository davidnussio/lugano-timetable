import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";

// Shared setup of the maps. Import it only from components loaded with
// `next/dynamic` and `ssr: false`: MapLibre needs the browser (WebGL).

// The bundler does not serve the worker next to MapLibre: it is copied to
// public/ on install (see `postinstall`)
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Light base map of swisstopo: vector tiles, free and without an API key
export const MAP_STYLE =
  "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";

// `--primary` and `--foreground` of the light theme: the base map is light
export const MAP_COLORS = {
  primary: "#1957d2",
  foreground: "#131922",
};
