"use client";

import type { FeatureCollection, LineString, Point } from "geojson";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AttributionControl,
  Layer,
  type LayerProps,
  Map as MapView,
  type MapLayerMouseEvent,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import { useI18n } from "~/i18n/i18n-provider";
import { MAP_COLORS, MAP_STYLE } from "~/lib/maplibre";

export interface LineMapStop {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly href?: string;
}

export interface LineMapBus {
  readonly uid: number;
  readonly lat: number;
  readonly lon: number;
  readonly label: string;
  readonly href: string;
  readonly delayed: boolean;
  // Where the GPS says, rather than estimated
  readonly gps: boolean;
}

// The stops of a line joined by straight segments (the streets are not
// known), and its buses where they are estimated to be. Tapping a stop
// opens its departures, a bus its trip.
export function LineMap({
  stops,
  buses,
  color,
}: {
  stops: ReadonlyArray<LineMapStop>;
  buses: ReadonlyArray<LineMapBus>;
  color: string;
}) {
  const { m } = useI18n();
  const router = useRouter();
  const [cursor, setCursor] = useState<string>();

  const path = useMemo(
    (): FeatureCollection<LineString> => ({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: stops.map((stop) => [stop.lon, stop.lat]),
          },
        },
      ],
    }),
    [stops]
  );

  const stopPoints = useMemo(
    (): FeatureCollection<Point> => ({
      type: "FeatureCollection",
      features: stops.map((stop) => ({
        type: "Feature",
        properties: { name: stop.name, ...(stop.href ? { href: stop.href } : {}) },
        geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
      })),
    }),
    [stops]
  );

  const busPoints: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: buses.map((bus) => ({
      type: "Feature",
      id: bus.uid,
      properties: { href: bus.href, label: bus.label, delayed: bus.delayed, gps: bus.gps },
      geometry: { type: "Point", coordinates: [bus.lon, bus.lat] },
    })),
  };

  const bounds = useMemo((): [number, number, number, number] | undefined => {
    if (stops.length === 0) return undefined;
    const lons = stops.map((stop) => stop.lon);
    const lats = stops.map((stop) => stop.lat);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }, [stops]);

  // Strings: the color of the line is a CSS variable when it has no color
  const lineColor = color.startsWith("#") ? color : MAP_COLORS.primary;

  const onClick = (event: MapLayerMouseEvent) => {
    const href = event.features?.[0]?.properties?.href;
    if (typeof href === "string") router.push(href);
  };

  return (
    <MapView
      initialViewState={
        bounds ? { bounds, fitBoundsOptions: { padding: 40 } } : undefined
      }
      mapStyle={MAP_STYLE}
      locale={m.map.controls}
      style={{ position: "absolute", inset: 0 }}
      attributionControl={false}
      interactiveLayerIds={["line-buses", "line-stops"]}
      cursor={cursor}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor(undefined)}
      onClick={onClick}>
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-right" compact />
      <Source id="line-path" type="geojson" data={path}>
        <Layer {...pathLayer(lineColor)} />
      </Source>
      <Source id="line-stops" type="geojson" data={stopPoints}>
        <Layer {...stopLayer(lineColor)} />
        <Layer {...stopNames} />
      </Source>
      <Source id="line-buses" type="geojson" data={busPoints}>
        <Layer {...busLayer(lineColor)} />
        <Layer {...busIcon} />
      </Source>
    </MapView>
  );
}

const pathLayer = (color: string): LayerProps => ({
  id: "line-path",
  type: "line",
  layout: { "line-join": "round", "line-cap": "round" },
  paint: { "line-color": color, "line-width": 4, "line-opacity": 0.8 },
});

const stopLayer = (color: string): LayerProps => ({
  id: "line-stops",
  type: "circle",
  paint: {
    "circle-color": "#ffffff",
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6],
    "circle-stroke-width": 2.5,
    "circle-stroke-color": color,
  },
});

const stopNames: LayerProps = {
  id: "line-stop-names",
  type: "symbol",
  minzoom: 14,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Frutiger Neue Condensed Medium"],
    "text-size": 12,
    "text-offset": [0, 1],
    "text-anchor": "top",
    "text-optional": true,
  },
  paint: {
    "text-color": MAP_COLORS.foreground,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

const busLayer = (color: string): LayerProps => ({
  id: "line-buses",
  type: "circle",
  paint: {
    "circle-color": color,
    "circle-radius": 11,
    // Estimated positions are paler than the GPS ones
    "circle-opacity": ["case", ["get", "gps"], 1, 0.75],
    "circle-stroke-width": 3,
    "circle-stroke-color": ["case", ["get", "delayed"], "#dc2626", "#ffffff"],
  },
});

// "B" in the circle: the swisstopo style serves no icons of buses
const busIcon: LayerProps = {
  id: "line-bus-icons",
  type: "symbol",
  layout: {
    "text-field": "B",
    "text-font": ["Frutiger Neue Condensed Bold"],
    "text-size": 13,
    "text-allow-overlap": true,
    "text-ignore-placement": true,
  },
  paint: { "text-color": "#ffffff" },
};
