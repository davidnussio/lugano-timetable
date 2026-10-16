"use client";

import type { FeatureCollection, Point } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibre,
} from "maplibre-gl";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import useSWR from "swr";
import { Switch } from "~/components/ui/switch";
import { useGeolocationGranted } from "~/hooks/use-geolocation";
import { useTargets } from "~/hooks/use-targets";
import type { Station } from "~/journey/models";
import { journeySearchStore } from "~/journey/search-store";
import { town } from "~/lib/format";
import { createLocalStore } from "~/lib/local-store";
import { MAP_COLORS, MAP_STYLE } from "~/lib/maplibre";
import type { Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";

const LUGANO = { latitude: 46.0037, longitude: 8.9511, zoom: 13 };

const { primary: PRIMARY, foreground: FOREGROUND } = MAP_COLORS;
// The stops of the other operators, apart from the blue of TPL
const OTHER = "#ea580c";

// Whether the map also shows the stops of the other operators
const allStopsStore = createLocalStore<boolean>(
  "lugano-timetable-map-all-stops",
  false,
  (value): value is boolean => typeof value === "boolean"
);

// The swisstopo layer of the points of interest, stops (red dots) included
const BASE_POIS = "poi_rank2";
const BASE_STOPS = [
  "aerialway_station",
  "bus_stop",
  "cable_car_station",
  "chair_lift_station",
  "elevator",
  "funicular_stop",
  "gondola_station",
  "halt",
  "subway_entrance",
  "subway_stop",
  "tram_stop",
];

// Hide the stops of the base map, keeping its other points of interest: the
// map draws its own
function hideBaseStops(map: MapLibre) {
  if (!map.getLayer(BASE_POIS)) return;
  // The swisstopo style writes its filters as expressions
  const filter = map.getFilter(BASE_POIS) as ExpressionSpecification | undefined;
  map.setFilter(BASE_POIS, [
    "all",
    filter ?? true,
    ["match", ["get", "subclass"], BASE_STOPS, false, true],
  ]);
}

// A stop of the map: of TPL, with its departures, or of another operator
interface StopProperties {
  readonly name: string;
  readonly town?: string;
  // The departures page of the TPL stops
  readonly href?: string;
  // National code and full name, for the journey planner
  readonly code?: string;
  readonly label: string;
}

type Stops = FeatureCollection<Point, StopProperties>;

const mean = (values: ReadonlyArray<number>) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// One point per stop, between its platforms: the stop page shows them all
function toStops(targets: ReadonlyArray<Target>): Stops {
  return {
    type: "FeatureCollection",
    features: targets.flatMap((target): Stops["features"] => {
      const platforms = target.Coordinates;
      if (platforms.length === 0) return [];
      return [
        {
          type: "Feature",
          id: platforms[0].Id,
          geometry: {
            type: "Point",
            coordinates: [
              mean(platforms.map(({ Lon }) => Lon)),
              mean(platforms.map(({ Lat }) => Lat)),
            ],
          },
          properties: {
            name: target.Name,
            town: town(target.Label),
            href: `/fermata/${target.Identifiers.join("/")}`,
            ...(target.CodeNat ? { code: target.CodeNat } : {}),
            label: target.Label,
          },
        },
      ];
    }),
  };
}

// The stops of the other operators: the TPL ones are already on the map
function toOtherStops(
  stations: ReadonlyArray<Station>,
  targets: ReadonlyArray<Target>
): Stops["features"] {
  const tpl = new Set(targets.flatMap((target) => target.CodeNat ?? []));
  return stations.flatMap((station): Stops["features"] => {
    if (!station.position || tpl.has(station.id)) return [];
    // "Certenago, Paese": the town apart, as for the TPL stops
    const comma = station.name.indexOf(",");
    return [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [station.position.lon, station.position.lat],
        },
        properties: {
          ...(comma === -1
            ? { name: station.name }
            : {
                name: station.name.slice(comma + 1).trim(),
                town: town(station.name),
              }),
          code: station.id,
          label: station.name,
        },
      },
    ];
  });
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
  filter: ["all", ["!", ["has", "point_count"]], ["has", "href"]],
  paint: {
    "circle-color": PRIMARY,
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 6, 18, 9],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
};

const otherStops: LayerProps = {
  id: "other-stops",
  type: "circle",
  filter: ["all", ["!", ["has", "point_count"]], ["!", ["has", "href"]]],
  paint: {
    "circle-color": OTHER,
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 5, 18, 8],
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
  const router = useRouter();
  const targets = useTargets();
  const allStops = allStopsStore.useValue() ?? false;
  const { data: stations } = useSWR<ReadonlyArray<Station>>(
    allStops ? "/api/journey/stops" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const tpl = useMemo(() => (targets ? toStops(targets) : undefined), [targets]);
  const data = useMemo(
    () =>
      tpl && targets && allStops && stations
        ? { ...tpl, features: [...tpl.features, ...toOtherStops(stations, targets)] }
        : tpl,
    [tpl, targets, allStops, stations]
  );
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

  // Fit the TPL stops once they are known
  useEffect(() => {
    const box = tpl && bounds(tpl);
    if (box && loaded) map.current?.fitBounds(box, { padding: 32, duration: 0 });
  }, [tpl, loaded]);

  // The journey planner, leaving from a stop
  const planFrom = ({ code, label, longitude, latitude }: Selected) => {
    if (!code) return;
    const from: Station = {
      id: code,
      name: label,
      position: { lat: latitude, lon: longitude },
    };
    journeySearchStore.set((search) => ({ ...search, from }));
    router.push("/tragitto");
  };

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
      interactiveLayerIds={["clusters", "stops", "other-stops"]}
      cursor={cursor}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor(undefined)}
      onClick={onClick}
      onLoad={(event) => {
        hideBaseStops(event.target);
        setLoaded(true);
      }}>
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl
        ref={geolocate}
        position="top-right"
        trackUserLocation
        showAccuracyCircle
      />
      <AttributionControl position="bottom-right" compact />
      <label className="absolute left-2.5 top-2.5 flex items-center gap-2 rounded-md bg-white py-1 pl-3 pr-1 text-sm font-medium text-neutral-900 shadow-[0_0_0_2px_rgba(0,0,0,0.1)]">
        Tutte le fermate
        <Switch
          checked={allStops}
          onCheckedChange={allStopsStore.set}
          label="Mostra anche le fermate degli altri operatori"
        />
      </label>
      {data && (
        <Source
          id="stops"
          type="geojson"
          data={data}
          cluster
          clusterRadius={50}
          // Stops are a couple of hundred meters apart: show them one by
          // one once zoomed in on the neighbourhood
          clusterMaxZoom={14}>
          <Layer {...clusters} />
          <Layer {...clusterCount} />
          <Layer {...otherStops} />
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
          <div className="flex flex-col gap-2 text-neutral-900">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{selected.name}</span>
              {selected.town && (
                <span className="text-xs text-neutral-500">{selected.town}</span>
              )}
            </span>
            <span className="flex items-center gap-4 text-sm font-medium text-[#1957d2]">
              {selected.href && (
                <Link href={selected.href} className="flex items-center">
                  Partenze
                  <ChevronRight className="size-4" />
                </Link>
              )}
              {selected.code && (
                <button
                  type="button"
                  onClick={() => planFrom(selected)}
                  className="flex items-center">
                  Tragitto da qui
                  <ChevronRight className="size-4" />
                </button>
              )}
            </span>
          </div>
        </Popup>
      )}
    </MapView>
  );
}
