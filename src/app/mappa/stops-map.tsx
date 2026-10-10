"use client";

import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  GeolocateControl,
  type GeolocateControlInstance,
  Layer,
  type LayerProps,
  Map as MapView,
  type MapLayerMouseEvent,
  type MapRef,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import { useGeolocationGranted } from "~/hooks/use-geolocation";
import { useTargets } from "~/hooks/use-targets";
import { town } from "~/lib/format";
import { MAP_COLORS, MAP_STYLE } from "~/lib/maplibre";
import type { Target } from "~/timetable/models";

const LUGANO = { latitude: 46.0037, longitude: 8.9511, zoom: 13 };

const { primary: PRIMARY, foreground: FOREGROUND } = MAP_COLORS;

interface StopProperties {
  readonly name: string;
  readonly town: string;
  readonly href: string;
}

type Stops = FeatureCollection<Point, StopProperties>;

// One point per platform: they are grouped while zoomed out
function toStops(targets: ReadonlyArray<Target>): Stops {
  return {
    type: "FeatureCollection",
    features: targets.flatMap((target) =>
      target.Coordinates.map(
        ({ Id, Lat, Lon }): Stops["features"][number] => ({
          type: "Feature",
          id: Id,
          geometry: { type: "Point", coordinates: [Lon, Lat] },
          properties: {
            name: target.Name,
            town: town(target.Label),
            href: `/fermata/${target.Identifiers.join("/")}`,
          },
        })
      )
    ),
  };
}

function bounds({ features }: Stops): [number, number, number, number] | undefined {
  if (features.length === 0) return undefined;
  const lons = features.map((feature) => feature.geometry.coordinates[0]);
  const lats = features.map((feature) => feature.geometry.coordinates[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

const clusters: LayerProps = {
  id: "clusters",
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": PRIMARY,
    "circle-opacity": 0.9,
    "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 30, 24],
    "circle-stroke-width": 3,
    "circle-stroke-color": "#ffffff",
  },
};

const clusterCount: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    // A font served by the swisstopo style
    "text-font": ["Frutiger Neue Condensed Bold"],
    "text-size": 14,
    "text-allow-overlap": true,
  },
  paint: { "text-color": "#ffffff" },
};

const stops: LayerProps = {
  id: "stops",
  type: "circle",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": PRIMARY,
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 6, 18, 9],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
};

const stopNames: LayerProps = {
  id: "stop-names",
  type: "symbol",
  filter: ["!", ["has", "point_count"]],
  minzoom: 16,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Frutiger Neue Condensed Medium"],
    "text-size": 13,
    "text-offset": [0, 1.1],
    "text-anchor": "top",
    "text-optional": true,
  },
  paint: {
    "text-color": FOREGROUND,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

interface Selected extends StopProperties {
  readonly longitude: number;
  readonly latitude: number;
}

export function StopsMap() {
  const targets = useTargets();
  const data = useMemo(() => (targets ? toStops(targets) : undefined), [targets]);
  const map = useRef<MapRef>(null);
  const geolocate = useRef<GeolocateControlInstance>(null);
  const granted = useGeolocationGranted();
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Selected>();
  const [cursor, setCursor] = useState<string>();

  // Show where the user is when it does not need to ask for the permission
  useEffect(() => {
    if (granted && loaded) geolocate.current?.trigger();
  }, [granted, loaded]);

  // Fit the stops once they are known
  useEffect(() => {
    const box = data && bounds(data);
    if (box && loaded) map.current?.fitBounds(box, { padding: 32, duration: 0 });
  }, [data, loaded]);

  const onClick = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (feature?.geometry.type !== "Point") {
      setSelected(undefined);
      return;
    }
    const [longitude, latitude] = feature.geometry.coordinates;
    if (feature.properties.cluster) {
      // Zoom in until the group splits up
      const source = map.current?.getSource<GeoJSONSource>("stops");
      const zoom = await source?.getClusterExpansionZoom(
        feature.properties.cluster_id
      );
      map.current?.easeTo({ center: [longitude, latitude], zoom });
      return;
    }
    setSelected({
      ...(feature.properties as StopProperties),
      longitude,
      latitude,
    });
  };

  return (
    <MapView
      ref={map}
      initialViewState={LUGANO}
      mapStyle={MAP_STYLE}
      style={{ position: "absolute", inset: 0 }}
      attributionControl={false}
      interactiveLayerIds={["clusters", "stops"]}
      cursor={cursor}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor(undefined)}
      onClick={onClick}
      onLoad={() => setLoaded(true)}>
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl
        ref={geolocate}
        position="top-right"
        trackUserLocation
        showAccuracyCircle
      />
      <AttributionControl position="bottom-right" compact />
      {data && (
        <Source
          id="stops"
          type="geojson"
          data={data}
          cluster
          clusterRadius={50}
          // Platforms of the same stop are a few meters apart: show them
          // one by one only when zoomed in on the street
          clusterMaxZoom={15}>
          <Layer {...clusters} />
          <Layer {...clusterCount} />
          <Layer {...stops} />
          <Layer {...stopNames} />
        </Source>
      )}
      {selected && (
        <Popup
          longitude={selected.longitude}
          latitude={selected.latitude}
          offset={14}
          closeButton={false}
          onClose={() => setSelected(undefined)}>
          <Link
            href={selected.href}
            className="flex items-center gap-3 text-neutral-900">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{selected.name}</span>
              <span className="text-xs text-neutral-500">{selected.town}</span>
            </span>
            <span className="flex shrink-0 items-center text-sm font-medium text-[#1957d2]">
              Partenze
              <ChevronRight className="size-4" />
            </span>
          </Link>
        </Popup>
      )}
    </MapView>
  );
}
