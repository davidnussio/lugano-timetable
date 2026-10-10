"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const FAVORITES_KEY = "lugano-timetable-favorites";

export interface FavoriteStop {
  name: string;
  label: string;
  identifiers: ReadonlyArray<string>;
}

// localStorage-backed store shared by every useFavorites() instance
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedFavorites: FavoriteStop[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): FavoriteStop[] {
  const raw = localStorage.getItem(FAVORITES_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedFavorites = raw ? JSON.parse(raw) : [];
    } catch {
      cachedFavorites = [];
    }
  }
  return cachedFavorites;
}

// Favorites are not known on the server nor during hydration
function getServerSnapshot(): FavoriteStop[] | null {
  return null;
}

function saveFavorites(newFavorites: FavoriteStop[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
  listeners.forEach((listener) => listener());
}

export function useFavorites() {
  const snapshot = useSyncExternalStore<FavoriteStop[] | null>(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const isLoaded = snapshot !== null;
  const favorites = useMemo(() => snapshot ?? [], [snapshot]);

  const addFavorite = useCallback(
    (stop: FavoriteStop) => {
      const exists = favorites.some(
        (f) => f.identifiers.join(",") === stop.identifiers.join(",")
      );
      if (!exists) {
        saveFavorites([...favorites, stop]);
      }
    },
    [favorites]
  );

  const removeFavorite = useCallback(
    (identifiers: ReadonlyArray<string>) => {
      const newFavorites = favorites.filter(
        (f) => f.identifiers.join(",") !== identifiers.join(",")
      );
      saveFavorites(newFavorites);
    },
    [favorites]
  );

  const isFavorite = useCallback(
    (identifiers: ReadonlyArray<string>) => {
      return favorites.some(
        (f) => f.identifiers.join(",") === identifiers.join(",")
      );
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    (stop: FavoriteStop) => {
      if (isFavorite(stop.identifiers)) {
        removeFavorite(stop.identifiers);
      } else {
        addFavorite(stop);
      }
    },
    [isFavorite, removeFavorite, addFavorite]
  );

  return {
    favorites,
    isLoaded,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
