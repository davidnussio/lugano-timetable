// Journeys planned with transport.opendata.ch, as sent to the browser. Plain
// types only, so that Effect is not pulled into the client bundle.
import type { Leg, Timing } from "~/timer/journey";

export interface Station {
  // National stop code, the `CodeNat` of the TPL platforms
  readonly id: string;
  readonly name: string;
  readonly position?: { readonly lat: number; readonly lon: number };
  // Meters from the searched position
  readonly distance?: number;
  // "bus", "train", "ship", "cableway"…
  readonly icon?: string;
}

export interface PlannedLeg extends Leg {
  readonly from: Station;
  readonly to: Station;
  // Trip number in the timetable ("004220"): finds the leg again
  readonly trip: string;
  // "B" (bus), "S", "RE", "IR", "EC"…
  readonly category: string;
  readonly operator?: string;
  // Walk before boarding, from the previous leg or from the start, as
  // planned by the timetable
  readonly walkBeforeMs?: number;
}

export interface Connection {
  readonly legs: ReadonlyArray<PlannedLeg>;
  // Walk from the last stop to the destination
  readonly walkAfterMs?: number;
}

// Latest timings of a leg, `null` when it is no longer in the timetable
export type LegUpdate = {
  readonly departure: Timing;
  readonly arrival: Timing;
} | null;
