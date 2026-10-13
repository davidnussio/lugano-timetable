"use client";

import type { Feature, LineString, Polygon } from "geojson";
import { Bus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Layer,
  Map as MapView,
  type MapRef,
  Marker,
  Source,
} from "react-map-gl/maplibre";
import { MAP_COLORS, MAP_STYLE } from "~/lib/maplibre";
import { distanceMeters, type Position } from "~/timer/plan";

// Blue of the "you are here" dot, as on the phone maps
const USER = "#0ea5e9";

const METERS_PER_DEGREE = 111_320;

// GPS fixes jitter by a few meters: move the user on the map only when the
// fix (or its accuracy) changes by this much, so that the map sources are
// updated only when the user really moves
const REDRAW_METERS = 5;

// Refit the map when the user moves this far from where it was last fitted
const REFIT_METERS = 15;

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

type Fix = Position & { readonly accuracy: number };

interface WalkMapProps {
  readonly stop: Position;
  readonly position: Fix | undefined;
}

const moved = (from: Fix | undefined, to: Fix | undefined) =>
  from === undefined || to === undefined
    ? from !== to
    : distanceMeters(from, to) >= REDRAW_METERS ||
      Math.abs(from.accuracy - to.accuracy) >= REDRAW_METERS;

// Where the user is compared to the stop of the timer. Not interactive: it is
// a glance, and it does not get in the way when scrolling the page.
export function WalkMap({ stop, position }: WalkMapProps) {
  const map = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  // Where the map was last fitted, with the stop it was fitted for
  const fitted = useRef<{ user: Position; stop: Position } | undefined>(undefined);
  // The fix drawn on the map, updated during render when the user moves
  const [shown, setShown] = useState(position);
  if (position !== shown && moved(shown, position)) setShown(position);
  const userLat = shown?.lat;
  const userLon = shown?.lon;
  const accuracy = shown?.accuracy;

  // New GeoJSON only when the user moves: the page re-renders every second,
  // and a new object makes the source set its data again
  const shapes = useMemo(() => {
    if (userLat === undefined || userLon === undefined || accuracy === undefined) {
      return undefined;
    }
    const user = { lat: userLat, lon: userLon };
    const target = { lat: stop.lat, lon: stop.lon };
    return { accuracy: circle(user, accuracy), walk: line(user, target) };
  }, [userLat, userLon, accuracy, stop.lat, stop.lon]);

  // Keep both the user and the stop in view as the user moves, without
  // animating the map at every GPS fix
  useEffect(() => {
    const view = map.current;
    if (!loaded || view === null) return;
    if (userLat === undefined || userLon === undefined) {
      fitted.current = undefined;
      view.easeTo({ center: [stop.lon, stop.lat], zoom: 16 });
      return;
    }
    const user = { lat: userLat, lon: userLon };
    const last = fitted.current;
    if (
      last !== undefined &&
      last.stop.lat === stop.lat &&
      last.stop.lon === stop.lon &&
      distanceMeters(last.user, user) < REFIT_METERS &&
      view.getBounds().contains([userLon, userLat])
    ) {
      return;
    }
    fitted.current = { user, stop: { lat: stop.lat, lon: stop.lon } };
    view.fitBounds(
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
      {shapes && userLat !== undefined && userLon !== undefined && (
        <>
          <Source id="accuracy" type="geojson" data={shapes.accuracy}>
            <Layer
              id="accuracy"
              type="fill"
              paint={{ "fill-color": USER, "fill-opacity": 0.15 }}
            />
          </Source>
          <Source id="walk" type="geojson" data={shapes.walk}>
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
          <Marker longitude={userLon} latitude={userLat}>
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
