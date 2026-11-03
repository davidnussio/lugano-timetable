// The lines of TPL, learned from the departures served by the RTPI server:
// it has no list of the lines, but every departure names its line, direction
// and routing, and with one of its stops the routing gives the stops of the
// line in order. Plain types and functions, shared with the browser.
import type { Itinerary } from "./schema";

// A departure of a line in a direction, enough to ask for its routing
export interface LineSeed {
  readonly route: string;
  readonly dir: string;
  readonly routing: string;
  // A platform where the line stops
  readonly target: string;
  // "6", as written on the bus
  readonly code: string;
  // Badge image ("6.jpg")
  readonly img: string;
  readonly dest: string;
}

export interface LineDirection {
  readonly dir: string;
  readonly dest: string;
  readonly target: string;
  readonly routing: string;
}

export interface Line {
  readonly route: string;
  readonly code: string;
  readonly img: string;
  readonly directions: ReadonlyArray<LineDirection>;
}

// A seed with how many times its routing was seen: the full trips are seen
// more often than the short ones
export interface SeenSeed {
  readonly seed: LineSeed;
  readonly hits: number;
}

export const seedKey = ({ route, dir, routing }: LineSeed) =>
  `${route}:${dir}:${routing}`;

// Only digits, as in the routing parameters of the RTPI server
const identifier = /^\d+$/;

export function isLineSeed(value: unknown): value is LineSeed {
  if (typeof value !== "object" || value === null) return false;
  const seed = value as Record<string, unknown>;
  return (
    ["route", "dir", "routing", "target"].every(
      (key) => typeof seed[key] === "string" && identifier.test(seed[key])
    ) &&
    ["code", "img", "dest"].every((key) => typeof seed[key] === "string")
  );
}

// The seeds of the departures, one per line, direction and routing
export function seedsOf(departures: ReadonlyArray<Itinerary>): ReadonlyArray<LineSeed> {
  const seeds = new Map<string, LineSeed>();
  for (const departure of departures) {
    const seed: LineSeed = {
      route: departure.Route,
      dir: departure.Dir,
      routing: departure.Routing,
      target: departure.Target,
      code: departure.RouteCode,
      img: departure.Img,
      dest: departure.Dest,
    };
    if (isLineSeed(seed)) seeds.set(seedKey(seed), seed);
  }
  return [...seeds.values()];
}

// Numbers first, in order ("2" before "10"), then the others by name
export const compareCodes = (a: string, b: string) => {
  const x = Number.parseInt(a, 10);
  const y = Number.parseInt(b, 10);
  if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
  return (Number.isNaN(x) ? 0 : x - y) || a.localeCompare(b, "it", { numeric: true });
};

// The lines of the seeds: for each direction the routing seen most often
export function linesOf(seen: ReadonlyArray<SeenSeed>): ReadonlyArray<Line> {
  const best = new Map<string, SeenSeed>();
  for (const entry of seen) {
    const key = `${entry.seed.route}:${entry.seed.dir}`;
    const current = best.get(key);
    if (current === undefined || entry.hits > current.hits) best.set(key, entry);
  }
  const lines = new Map<string, { line: Line; directions: Array<LineDirection> }>();
  for (const { seed } of best.values()) {
    let entry = lines.get(seed.route);
    if (entry === undefined) {
      const directions: Array<LineDirection> = [];
      entry = {
        line: { route: seed.route, code: seed.code, img: seed.img, directions },
        directions,
      };
      lines.set(seed.route, entry);
    }
    entry.directions.push({
      dir: seed.dir,
      dest: seed.dest,
      target: seed.target,
      routing: seed.routing,
    });
  }
  return [...lines.values()]
    .map(({ line, directions }) => ({
      ...line,
      directions: directions.sort((a, b) => a.dir.localeCompare(b.dir)),
    }))
    .sort((a, b) => compareCodes(a.code, b.code));
}
