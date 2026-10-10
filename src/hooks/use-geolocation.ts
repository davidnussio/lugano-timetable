"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Position } from "~/timer/plan";

export interface GeolocationState {
  readonly position?: Position & { readonly accuracy: number };
  readonly error?: "denied" | "unavailable" | "unsupported";
}

// One watchPosition shared by every component asking for the location: it
// runs while at least one of them is mounted with `enabled`.
const listeners = new Set<() => void>();
let state: GeolocationState = {};
let watchId: number | undefined;

function emit(next: GeolocationState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (watchId === undefined) {
    // Forget a previous error: the user may have granted the permission since
    state = { position: state.position };
    if (!("geolocation" in navigator)) {
      emit({ error: "unsupported" });
    } else {
      watchId = navigator.geolocation.watchPosition(
        ({ coords }) =>
          emit({
            position: {
              lat: coords.latitude,
              lon: coords.longitude,
              accuracy: coords.accuracy,
            },
          }),
        (error) =>
          emit({
            ...state,
            error:
              error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
          }),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
      );
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && watchId !== undefined) {
      navigator.geolocation.clearWatch(watchId);
      watchId = undefined;
    }
  };
}

const noop = () => () => {};
const empty: GeolocationState = {};

export function useGeolocation(enabled: boolean): GeolocationState {
  return useSyncExternalStore(
    enabled ? subscribe : noop,
    () => (enabled ? state : empty),
    () => empty
  );
}

// Whether the location can be read without prompting the user
export function useGeolocationGranted(): boolean {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let status: PermissionStatus | undefined;
    const update = () => setGranted(status?.state === "granted");
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        status = result;
        update();
        status.addEventListener("change", update);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", update);
  }, []);

  return granted;
}
