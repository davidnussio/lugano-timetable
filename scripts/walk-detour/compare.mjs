// Collects walking routes between pairs of TPL stops of Lugano, from three
// free routers on OpenStreetMap: Valhalla and OSRM (servers of FOSSGIS) and
// the shortest path of BRouter, which takes every footway and stair. With the
// climb between the two stops from swisstopo, through the app.
//
// Needs the app running (pnpm dev) for the stops and the heights. Waits a
// second between the requests: the public servers are for a fair use.
//
//   node scripts/walk-detour/compare.mjs [out.json]
//   SEED=7 PAIRS=120 BASE=http://localhost:3000 node scripts/walk-detour/compare.mjs
//
// The routes of routes.json were collected in October 2026 with SEED=42
// PAIRS=40 and SEED=7 PAIRS=120 (duplicates removed). Fitted with fit.mjs.
import { writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "routes-new.json";
const SEED = Number(process.env.SEED ?? 42);
const PAIRS = Number(process.env.PAIRS ?? 40);
const BASE = process.env.BASE ?? "http://localhost:3000";
const USER_AGENT = "lugano-timetable walk detour comparison (https://bus.oggi.ch)";

// Stops of Lugano and around, from 250 m to 1.5 km apart
const AREA = { south: 45.98, north: 46.05, west: 8.9, east: 9.0 };
const MIN_METERS = 250;
const MAX_METERS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const radians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance, as `distanceMeters` of src/timer/plan.ts
function distanceMeters(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// The same pairs for the same seed
let seed = SEED;
const random = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

async function json(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url.slice(0, 80)}`);
  return response.json();
}

// Meters and seconds of the walk from `a` to `b`
const routers = {
  async valhalla(a, b) {
    const query = {
      locations: [
        { lat: a.lat, lon: a.lon },
        { lat: b.lat, lon: b.lon },
      ],
      costing: "pedestrian",
      directions_type: "none",
    };
    const { trip } = await json(
      `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(query))}`
    );
    return { meters: trip.summary.length * 1000, seconds: trip.summary.time };
  },
  async osrm(a, b) {
    const { routes } = await json(
      `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`
    );
    return { meters: routes[0].distance, seconds: routes[0].duration };
  },
  async brouter(a, b) {
    const { features } = await json(
      `https://brouter.de/brouter?lonlats=${a.lon},${a.lat}|${b.lon},${b.lat}&profile=shortest&alternativeidx=0&format=geojson`
    );
    const properties = features[0].properties;
    return {
      meters: Number(properties["track-length"]),
      seconds: Number(properties["total-time"]),
      ascend: Number(properties["filtered ascend"]),
    };
  },
};

const height = async ({ lat, lon }) =>
  (await json(`${BASE}/api/height?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`)).height;

// One point per stop: its first platform
const stops = (await json(`${BASE}/api/timetable/targets`))
  .map((target) => ({
    name: target.Label,
    lat: target.Coordinates[0].Lat,
    lon: target.Coordinates[0].Lon,
  }))
  .filter(
    ({ lat, lon }) => lat > AREA.south && lat < AREA.north && lon > AREA.west && lon < AREA.east
  );

const pairs = [];
const seen = new Set();
while (pairs.length < PAIRS) {
  const from = stops[Math.floor(random() * stops.length)];
  const to = stops[Math.floor(random() * stops.length)];
  const straight = distanceMeters(from, to);
  const key = [from.name, to.name].sort().join("|");
  if (from === to || straight < MIN_METERS || straight > MAX_METERS || seen.has(key)) continue;
  seen.add(key);
  pairs.push({ from, to, straight });
}

const routes = [];
for (const [index, pair] of pairs.entries()) {
  const route = { ...pair };
  try {
    route.climb = (await height(pair.to)) - (await height(pair.from));
  } catch {
    route.climb = null;
  }
  for (const [name, walk] of Object.entries(routers)) {
    try {
      route[name] = await walk(pair.from, pair.to);
    } catch (error) {
      route[name] = { error: String(error.message ?? error) };
    }
    await sleep(1100);
  }
  routes.push(route);
  console.error(`${index + 1}/${pairs.length} ${pair.from.name} → ${pair.to.name}`);
}
writeFileSync(OUT, `${JSON.stringify(routes, null, 1)}\n`);
