// The lines of TPL, as the official app 4.0.12 builds them: the list from
// GETROUTES, and the platforms of each line and direction from the
// `RoutesDirections` of every platform in GETTARGETS. The order of the stops
// comes later, from the routing of a trip. Plain types, shared with the
// browser.
import { rtpiText } from "./rtpi-values";

// What `toLines` reads of the answers, without depending on Effect
interface RouteFields {
  readonly Uid?: unknown;
  readonly Code?: unknown;
  readonly ShortCode?: unknown;
  readonly Description?: unknown;
  readonly Backcolor?: unknown;
  readonly Forecolor?: unknown;
}

interface TargetFields {
  readonly Name?: unknown;
  readonly Identifiers?: ReadonlyArray<{
    readonly Id?: unknown;
    readonly RoutesDirections?: ReadonlyArray<{
      readonly uid?: unknown;
      readonly dir?: unknown;
      readonly des?: unknown;
    }>;
  }>;
}

export interface LineDirection {
  readonly dir: string;
  readonly dest: string;
  // Platforms where the line stops in this direction, the best first to
  // ask for the routing (not the end of the line)
  readonly targets: ReadonlyArray<string>;
}

export interface Line {
  // The id of the RTPI server ("23"), `Route` of the departures
  readonly route: string;
  // "6", as written on the bus
  readonly code: string;
  readonly description?: string;
  readonly color?: string;
  readonly textColor?: string;
  readonly directions: ReadonlyArray<LineDirection>;
}

// Platforms kept per direction: the next ones are tried when a routing is
// empty, a few are enough
const TARGETS_PER_DIRECTION = 5;

// "#1E90FF", "1e90ff", "0x1E90FF" or "#fff" as "#1e90ff" or "#fff"
export function hexColor(value: unknown): string | undefined {
  const text = rtpiText(value);
  const match = text && /^(?:#|0x)?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(text);
  return match ? `#${match[1].toLowerCase()}` : undefined;
}

// Numbers first, in order ("2" before "10"), then the others by name
export const compareCodes = (a: string, b: string) => {
  const x = Number.parseInt(a, 10);
  const y = Number.parseInt(b, 10);
  if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
  return (Number.isNaN(x) ? 0 : x - y) || a.localeCompare(b, "it", { numeric: true });
};

const mostFrequent = (values: ReadonlyArray<string>): string | undefined => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | undefined;
  for (const [value, count] of counts) {
    if (best === undefined || count > counts.get(best)!) best = value;
  }
  return best;
};

export function toLines(
  routes: ReadonlyArray<RouteFields>,
  targets: ReadonlyArray<TargetFields>
): ReadonlyArray<Line> {
  // Line and direction → the platforms and destinations seen
  const stops = new Map<
    string,
    { platforms: Array<{ id: string; name?: string }>; dests: Array<string> }
  >();
  for (const target of targets) {
    const name = rtpiText(target.Name);
    for (const identifier of target.Identifiers ?? []) {
      const id = rtpiText(identifier.Id);
      if (id === undefined) continue;
      for (const direction of identifier.RoutesDirections ?? []) {
        const uid = rtpiText(direction.uid);
        const dir = rtpiText(direction.dir);
        if (uid === undefined || dir === undefined) continue;
        const key = `${uid}:${dir}`;
        let entry = stops.get(key);
        if (entry === undefined) {
          entry = { platforms: [], dests: [] };
          stops.set(key, entry);
        }
        if (!entry.platforms.some((platform) => platform.id === id)) {
          entry.platforms.push({ id, ...(name && { name }) });
        }
        const dest = rtpiText(direction.des);
        if (dest) entry.dests.push(dest);
      }
    }
  }

  const lines = new Map<string, Line>();
  for (const route of routes) {
    const uid = rtpiText(route.Uid);
    if (uid === undefined || lines.has(uid)) continue;
    const directions: Array<LineDirection> = [];
    for (const [key, entry] of stops) {
      const [line, dir] = key.split(":");
      if (line !== uid) continue;
      const dest = mostFrequent(entry.dests) ?? "";
      // A platform named as the destination is where the trips end: asked
      // last, it may have no trip to give the routing of
      const ordered = [
        ...entry.platforms.filter((platform) => platform.name !== dest),
        ...entry.platforms.filter((platform) => platform.name === dest),
      ];
      directions.push({
        dir,
        dest,
        targets: ordered.slice(0, TARGETS_PER_DIRECTION).map((platform) => platform.id),
      });
    }
    directions.sort((a, b) => a.dir.localeCompare(b.dir, "it", { numeric: true }));
    const description = rtpiText(route.Description);
    const color = hexColor(route.Backcolor);
    const textColor = hexColor(route.Forecolor);
    lines.set(uid, {
      route: uid,
      code: rtpiText(route.ShortCode) ?? rtpiText(route.Code) ?? uid,
      ...(description && { description }),
      ...(color && { color }),
      ...(textColor && { textColor }),
      directions,
    });
  }
  return [...lines.values()].sort((a, b) => compareCodes(a.code, b.code));
}
