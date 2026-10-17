// Usual journeys ("tragitti abituali"): a trip made on given days to arrive
// by a given time, with push notifications telling when to leave home.
// Without Effect, shared by the browser and the server.

export interface RoutineStation {
  // National stop code, as for the journey planner
  readonly id: string;
  readonly name: string;
}

// A few journeys per device are plenty: keeps the tick fast
export const MAX_ROUTINES = 10;

export interface Routine {
  // Random, chosen by the browser that saves it
  readonly id: string;
  readonly from: RoutineStation;
  readonly to: RoutineStation;
  // ISO weekdays: 1 is Monday, 7 Sunday
  readonly days: ReadonlyArray<number>;
  // "07:55", local time in Lugano
  readonly arriveBy: string;
  // From home to the first stop
  readonly walkMinutes: number;
  // How long the journey took when saved: when to start looking for it
  readonly durationMinutes: number;
  readonly paused: boolean;
}

// What the service worker shows: `tag` replaces the previous notification
// of the same routine
export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
  readonly url: string;
}
