// Types shared with the client components. Schema types are re-exported as
// types only, so that Effect is not pulled into the browser bundle.
export type { Itinerary, RoutingStop, Target } from "./schema";

export enum RoutingStatus {
  FeatureStation = 0,
  CurrentStation = 1,
  PassedStation = 2,
}

export enum InTimeStatus {
  OnTime = 1,
  Delayed = 0,
}

// Result of a monitored request: `ready` is false while the RTPI server is
// still preparing the data for the session.
export interface Monitored<A> {
  readonly ready: boolean;
  readonly data: ReadonlyArray<A>;
}
