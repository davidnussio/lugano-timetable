import { type Departure, RoutingStatus } from "~/timetable/models";

export type BusPosition =
  // Still at (or before) the first stop
  | { readonly kind: "origin" }
  | { readonly kind: "at"; readonly index: number }
  // Left `from`, heading to the next stop
  | { readonly kind: "between"; readonly from: number }
  | { readonly kind: "arrived" };

export type StopState = "passed" | "current" | "upcoming";

const passed = (status: RoutingStatus) =>
  status === RoutingStatus.PassedStation || status === RoutingStatus.Origin;

// Where the bus is, from the status of each stop of the routing
export function busPosition(
  stops: ReadonlyArray<{ readonly Status: RoutingStatus }>
): BusPosition {
  const at = stops.findIndex((s) => s.Status === RoutingStatus.CurrentStation);
  if (at !== -1) return { kind: "at", index: at };
  const from = stops.findLastIndex((s) => passed(s.Status));
  if (from === -1) return { kind: "origin" };
  if (from === stops.length - 1) return { kind: "arrived" };
  return { kind: "between", from };
}

export function stopState(position: BusPosition, index: number): StopState {
  switch (position.kind) {
    case "origin":
      return index === 0 ? "current" : "upcoming";
    case "at":
      return index < position.index
        ? "passed"
        : index === position.index
          ? "current"
          : "upcoming";
    case "between":
      return index <= position.from ? "passed" : "upcoming";
    case "arrived":
      return "passed";
  }
}

// Index of the next stop the bus will reach (or is at)
export function busIndex(position: BusPosition, length: number): number {
  switch (position.kind) {
    case "origin":
      return 0;
    case "at":
      return position.index;
    case "between":
      return position.from + 1;
    case "arrived":
      return length;
  }
}

// Index of the last stop the bus has reached: it is there or has left it
export function reachedIndex(position: BusPosition, length: number): number {
  switch (position.kind) {
    case "origin":
      return 0;
    case "at":
      return position.index;
    case "between":
      return position.from;
    case "arrived":
      return length - 1;
  }
}

// The departure of the trip from the stop of the user: the run passing at
// `time` (the stop's time in the routing), else the soonest of the line
export function tripDeparture(
  departures: ReadonlyArray<Departure>,
  trip: {
    readonly target: string;
    readonly route: string;
    readonly dir: string;
    readonly routing: string;
  },
  time: string | undefined
): Departure | undefined {
  const runs = departures.filter(
    (d) =>
      d.Target === trip.target &&
      d.Route === trip.route &&
      d.Dir === trip.dir &&
      d.Routing === trip.routing
  );
  const soonest = runs.reduce<Departure | undefined>(
    (best, d) =>
      best === undefined ||
      (d.DepartureAt ?? Infinity) < (best.DepartureAt ?? Infinity)
        ? d
        : best,
    undefined
  );
  return runs.find((d) => d.Time === time) ?? soonest;
}
