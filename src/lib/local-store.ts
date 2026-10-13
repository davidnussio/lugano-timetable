"use client";

import { useSyncExternalStore } from "react";

// A JSON value persisted in localStorage, shared by every component using it
// and synced across tabs. `null` on the server and during hydration.
// `isValid` drops a stored value of another shape (an older version of the
// app, a corrupted entry), which would otherwise break every render.
export function createLocalStore<A>(
  key: string,
  initial: A,
  isValid: (value: unknown) => value is A = (value): value is A => value !== undefined
) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: A = initial;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  };

  const get = (): A => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // Storage blocked (e.g. private mode): keep the in-memory value
      return cached;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        const value: unknown = raw === null ? initial : JSON.parse(raw);
        cached = isValid(value) ? value : initial;
      } catch {
        cached = initial;
      }
    }
    return cached;
  };

  const set = (value: A | ((previous: A) => A)) => {
    const next =
      typeof value === "function"
        ? (value as (previous: A) => A)(get())
        : value;
    cached = next;
    try {
      cachedRaw = JSON.stringify(next);
      localStorage.setItem(key, cachedRaw);
    } catch {
      // Not persisted, still shared in memory
    }
    listeners.forEach((listener) => listener());
  };

  const useValue = (): A | null =>
    useSyncExternalStore<A | null>(subscribe, get, () => null);

  return { get, set, useValue };
}
