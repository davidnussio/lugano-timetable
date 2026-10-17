"use client";

import type { Connection } from "~/journey/models";
import { createLocalStore } from "~/lib/local-store";
import { expected } from "~/timer/journey";
import type { Routine } from "./models";

// The usual journeys of this device, kept in the browser to list them. The
// server has a copy to send the notifications: the browser sends it the
// whole list on every change and when the app opens.

const isRoutine = (value: unknown): value is Routine => {
  if (typeof value !== "object" || value === null) return false;
  const routine = value as Partial<Routine>;
  return (
    typeof routine.id === "string" &&
    typeof routine.from?.id === "string" &&
    typeof routine.to?.id === "string" &&
    Array.isArray(routine.days) &&
    typeof routine.arriveBy === "string" &&
    typeof routine.walkMinutes === "number" &&
    typeof routine.durationMinutes === "number" &&
    typeof routine.paused === "boolean"
  );
};

export const isRoutineList = (value: unknown): value is ReadonlyArray<Routine> =>
  Array.isArray(value) && value.every(isRoutine);

export const routinesStore = createLocalStore<ReadonlyArray<Routine>>(
  "lugano-timetable-routines",
  [],
  isRoutineList
);

export const WORKDAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5];
const DEFAULT_WALK_MINUTES = 5;
const DEFAULT_DURATION_MINUTES = 30;

const clock = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

// The arrival of a connection rounded up to 5 minutes ("07:55"): a first
// guess of the time to be there
export function defaultArriveBy(connection: Connection | undefined): string {
  if (connection === undefined) return "08:00";
  const arrival = expected(connection.legs[connection.legs.length - 1].arrival);
  const step = 5 * 60_000;
  return clock.format(Math.ceil(arrival / step) * step);
}

// The walk planned by the timetable before the first bus, if any
export function defaultWalkMinutes(connection: Connection | undefined): number {
  const walk = connection?.legs[0]?.walkBeforeMs;
  return walk === undefined ? DEFAULT_WALK_MINUTES : Math.min(60, Math.max(1, Math.round(walk / 60_000)));
}

// From the first bus to the destination
export function durationMinutes(connection: Connection | undefined): number {
  if (connection === undefined) return DEFAULT_DURATION_MINUTES;
  const { legs, walkAfterMs } = connection;
  const ms = expected(legs[legs.length - 1].arrival) + (walkAfterMs ?? 0) - expected(legs[0].departure);
  return Math.min(240, Math.max(1, Math.round(ms / 60_000)));
}

// The VAPID public key, base64url as printed by `web-push`, as the bytes
// expected by `pushManager.subscribe`
export function decodeKey(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const sameBytes = (a: ArrayBuffer | null, b: Uint8Array) => {
  if (a === null || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, index) => byte === b[index]);
};

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// The push subscription of this browser. With `create`, made when missing
// or tied to other keys (the keys of the server changed): the permission
// must be granted already.
export async function pushSubscription(create: boolean): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null;
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const key = decodeKey(VAPID_PUBLIC_KEY);
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameBytes(existing.options.applicationServerKey, key)) return existing;
  if (!create) return null;
  await existing?.unsubscribe();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

// Sends the whole list to the server, which replaces its copy
export async function saveRoutines(
  subscription: PushSubscription,
  routines: ReadonlyArray<Routine>
): Promise<void> {
  const response = await fetch("/api/routines", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), routines }),
  });
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
}

// A new usual journey, with an id that is also a valid Topic of the push
// messages (32 URL-safe characters)
export function newRoutineId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
