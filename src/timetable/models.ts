// Types shared with the client components. Schema types are re-exported as
// types only, so that Effect is not pulled into the browser bundle.
import type { Itinerary } from "./schema";

export type { Coordinates, Itinerary, RoutingStop, Target } from "./schema";

// Itinerary with its departure as epoch milliseconds, computed by the server
// from `Wait` (absent when the RTPI server does not send it).
export interface Departure extends Itinerary {
  readonly DepartureAt?: number;
}

export enum RoutingStatus {
  FeatureStation = 0,
  // The bus is at the stop
  CurrentStation = 1,
  PassedStation = 2,
  // First stop of the trip, sent with time "00:00"
  Origin = 3,
}

export enum InTimeStatus {
  OnTime = 1,
  Delayed = 0,
}

// The vehicle running a trip, sent with its routing: where it is when it
// has a GPS fix
export interface Vehicle {
  readonly vehicle?: string;
  // Last message of the vehicle, as sent by the server
  readonly lastcom?: string;
  readonly delaySeconds?: number;
  // Share of the trip travelled, 0 to 100
  readonly distancePercent?: number;
  readonly position?: { readonly lat: number; readonly lon: number };
}

// Result of a monitored request: `ready` is false while the RTPI server is
// still preparing the data for the session.
export interface Monitored<A> {
  readonly ready: boolean;
  readonly data: ReadonlyArray<A>;
  // Only for a routing, when the server tells
  readonly vehicle?: Vehicle;
}
