// Conversions from the transport.opendata.ch responses to the app models
import type { Timing } from "~/timer/journey";
import type {
  Connection,
  LegUpdate,
  PlannedLeg,
  Station,
  StationDeparture,
} from "./models";
import type {
  Checkpoint,
  OpendataConnection,
  OpendataStation,
  StationboardEntry,
} from "./schema";

// "2026-10-11T19:10:00+0200": the offset needs a colon to be parsed as ISO
export function parseTime(time: string | null | undefined): number | undefined {
  if (!time) return undefined;
  const ms = Date.parse(time.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? undefined : ms;
}

export function toStation(station: OpendataStation): Station | undefined {
  if (!station.id || !station.name) return undefined;
  const lat = station.coordinate?.x;
  const lon = station.coordinate?.y;
  return {
    id: station.id,
    name: station.name,
    ...(typeof lat === "number" && typeof lon === "number"
      ? { position: { lat, lon } }
      : {}),
    ...(typeof station.distance === "number"
      ? { distance: Math.round(station.distance) }
      : {}),
    ...(station.icon ? { icon: station.icon } : {}),
  };
}

function timing(
  checkpoint: Checkpoint,
  kind: "arrival" | "departure"
): Timing | undefined {
  const timestamp = checkpoint[`${kind}Timestamp`];
  if (typeof timestamp !== "number") return undefined;
  const estimated = parseTime(checkpoint.prognosis?.[kind]);
  return {
    scheduled: timestamp * 1000,
    ...(estimated === undefined ? {} : { estimated }),
  };
}

// Buses, trams and the like are known by their number, trains by category
// and number ("S10", "RE80"), long distance trains by category ("IC", "EC")
const LOCAL = new Set(["B", "BN", "BUS", "T", "M", "NFB", "NFO", "FUN", "BAT"]);

export function lineLabel(category: string, number: string | null | undefined) {
  if (!number) return category;
  if (LOCAL.has(category.toUpperCase())) return number;
  return /^[1-9]\d{0,2}$/.test(number) ? `${category}${number}` : category;
}

export function toConnection(
  connection: OpendataConnection
): Connection | undefined {
  const legs: Array<PlannedLeg> = [];
  let walkMs: number | undefined;

  for (const section of connection.sections) {
    const { journey, walk } = section;
    if (!journey) {
      const duration = walk?.duration;
      if (typeof duration === "number") {
        walkMs = (walkMs ?? 0) + duration * 1000;
      }
      continue;
    }
    const from = toStation(section.departure.station);
    const to = toStation(section.arrival.station);
    const departure = timing(section.departure, "departure");
    const arrival = timing(section.arrival, "arrival");
    if (!from || !to || !departure || !arrival) return undefined;
    legs.push({
      trip: journey.name,
      category: journey.category,
      line: lineLabel(journey.category, journey.number),
      ...(journey.operator ? { operator: journey.operator } : {}),
      destination: journey.to ?? to.name,
      from,
      to,
      departure,
      arrival,
      ...(walkMs === undefined ? {} : { walkBeforeMs: walkMs }),
    });
    walkMs = undefined;
  }

  if (legs.length === 0) return undefined;
  return { legs, ...(walkMs === undefined ? {} : { walkAfterMs: walkMs }) };
}

// The leg `trip` in the departures of its boarding stop, with its arrival at
// `to` from the stops it passes
export function toLegUpdate(
  entries: ReadonlyArray<StationboardEntry>,
  trip: string,
  to: string
): LegUpdate {
  const entry = entries.find((candidate) => candidate.name === trip);
  if (!entry) return null;
  const stop = entry.passList.find(
    (checkpoint) => checkpoint.station.id === to
  );
  const departure = timing(entry.stop, "departure");
  const arrival = stop && timing(stop, "arrival");
  return departure && arrival ? { departure, arrival } : null;
}

// A departure of the stationboard. Without a scheduled time there is
// nothing to count down to.
export function toStationDeparture(
  entry: StationboardEntry
): StationDeparture | undefined {
  const departure = timing(entry.stop, "departure");
  const destination = entry.to ?? entry.passList.at(-1)?.station.name;
  if (!departure || !destination) return undefined;
  const platform = entry.stop.prognosis?.platform ?? entry.stop.platform;
  return {
    trip: entry.name,
    line: lineLabel(entry.category, entry.number),
    category: entry.category,
    ...(entry.operator ? { operator: entry.operator } : {}),
    destination,
    departure,
    ...(platform ? { platform } : {}),
  };
}

const localDateTime = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

// "2026-10-11 19:06", the local time expected by the `datetime` parameters
export function opendataDateTime(ms: number): string {
  return localDateTime.format(ms);
}
