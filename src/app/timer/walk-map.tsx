"use client";

import type { Feature, LineString, Polygon } from "geojson";
import { Bus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Layer,
  Map as MapView,
  type MapRef,
  Marker,
  Source,
} from "react-map-gl/maplibre";
import { MAP_COLORS, MAP_STYLE } from "~/lib/maplibre";
import type { Position } from "~/timer/plan";

// Blue of the "you are here" dot, as on the phone maps
const USER = "#0ea5e9";

const METERS_PER_DEGREE = 111_320;

// The GPS accuracy as a polygon: good enough for a few hundred meters
function circle({ lat, lon }: Position, meters: number, steps = 48): Feature<Polygon> {
  const dLat = meters / METERS_PER_DEGREE;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    return [lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)];
  });
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: {},
  };
}

function line(from: Position, to: Position): Feature<LineString> {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ],
    },
    properties: {},
  };
}

interface WalkMapProps {
  readonly stop: Position;
  readonly position: (Position & { readonly accuracy: number }) | undefined;
}

// Where the user is compared to the stop of the timer. Not interactive: it is
// a glance, and it does not get in the way when scrolling the page.
export function WalkMap({ stop, position }: WalkMapProps) {
  const map = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const userLat = position?.lat;
  const userLon = position?.lon;

  // Keep both the user and the stop in view as the user moves
  useEffect(() => {
    if (!loaded) return;
    if (userLat === undefined || userLon === undefined) {
      map.current?.easeTo({ center: [stop.lon, stop.lat], zoom: 16 });
      return;
    }
    map.current?.fitBounds(
      [
        [Math.min(userLon, stop.lon), Math.min(userLat, stop.lat)],
        [Math.max(userLon, stop.lon), Math.max(userLat, stop.lat)],
      ],
      // More room at the bottom, under the attribution
      { padding: { top: 40, right: 48, bottom: 72, left: 48 }, maxZoom: 17, duration: 600 }
    );
  }, [loaded, userLat, userLon, stop.lat, stop.lon]);

  return (
    <MapView
      ref={map}
      initialViewState={{ longitude: stop.lon, latitude: stop.lat, zoom: 16 }}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      interactive={false}
      attributionControl={false}
      onLoad={() => setLoaded(true)}>
      <AttributionControl position="bottom-right" compact />
      {position && (
        <>
          <Source id="accuracy" type="geojson" data={circle(position, position.accuracy)}>
            <Layer
              id="accuracy"
              type="fill"
              paint={{ "fill-color": USER, "fill-opacity": 0.15 }}
            />
          </Source>
          <Source id="walk" type="geojson" data={line(position, stop)}>
            <Layer
              id="walk"
              type="line"
              layout={{ "line-cap": "round" }}
              paint={{
                "line-color": MAP_COLORS.foreground,
                "line-opacity": 0.6,
                "line-width": 2,
                "line-dasharray": [1, 2],
              }}
            />
          </Source>
          <Marker longitude={position.lon} latitude={position.lat}>
            <span
              className="block size-4 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: USER }}
            />
          </Marker>
        </>
      )}
      <Marker longitude={stop.lon} latitude={stop.lat}>
        <span
          className="grid size-8 place-items-center rounded-full border-2 border-white text-white shadow-md"
          style={{ backgroundColor: MAP_COLORS.foreground }}>
          <Bus className="size-4" />
        </span>
      </Marker>
    </MapView>
  );
}
