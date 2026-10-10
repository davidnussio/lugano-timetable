"use client";

import { useSyncExternalStore } from "react";

// A clock ticking every second, shared by all the countdowns on the page.
const listeners = new Set<() => void>();
let now = Date.now();
let interval: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (interval === undefined) {
    now = Date.now();
    interval = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(interval);
      interval = undefined;
    }
  };
}

const noop = () => () => {};

// Current time in milliseconds, 0 on the server, during hydration and while
// not `enabled`
export function useNow(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribe : noop,
    () => (enabled ? now : 0),
    () => 0
  );
}
