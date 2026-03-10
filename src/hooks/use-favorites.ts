"use client";

import { useCallback, useEffect, useState } from "react";

const FAVORITES_KEY = "lugano-timetable-favorites";

export interface FavoriteStop {
  name: string;
  label: string;
  identifiers: string[];
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteStop[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveFavorites = useCallback((newFavorites: FavoriteStop[]) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    setFavorites(newFavorites);
  }, []);

  const addFavorite = useCallback(
    (stop: FavoriteStop) => {
      const exists = favorites.some(
        (f) => f.identifiers.join(",") === stop.identifiers.join(",")
      );
      if (!exists) {
        saveFavorites([...favorites, stop]);
      }
    },
    [favorites, saveFavorites]
  );

  const removeFavorite = useCallback(
    (identifiers: string[]) => {
      const newFavorites = favorites.filter(
        (f) => f.identifiers.join(",") !== identifiers.join(",")
      );
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  const isFavorite = useCallback(
    (identifiers: string[]) => {
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
