/**
 * Hook to manage favorites state at list level for performance optimization.
 * Single Zustand subscription instead of N per row.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useFavorites } from '@/lib/strains/use-favorites';
import type { Strain } from '@/types/strains';

type UseListFavoritesResult = {
  /** Set of favorite strain IDs and slugs for O(1) lookup */
  favoriteIds: Set<string>;
  /** Check if a strain is favorited */
  isFavorite: (strain: Strain) => boolean;
  /** Create a toggle handler for a specific strain */
  createToggleHandler: (strain: Strain) => () => void;
};

/**
 * Manages favorites state at list level to avoid N Zustand subscriptions.
 * Returns a Set for O(1) lookup and a factory for toggle handlers.
 */
export function useListFavorites(): UseListFavoritesResult {
  const { isHydrated, favorites, addFavorite, removeFavorite } = useFavorites(
    useShallow((state) => ({
      isHydrated: state.isHydrated,
      favorites: state.favorites,
      addFavorite: state.addFavorite,
      removeFavorite: state.removeFavorite,
    }))
  );

  // Compute favorite IDs set for O(1) lookup
  const favoriteIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const key of Object.keys(favorites)) {
      const fav = favorites[key];
      if (fav) {
        ids.add(fav.id);
        if (fav.snapshot.slug) {
          ids.add(fav.snapshot.slug);
        }
      }
    }
    return ids;
  }, [favorites]);

  // Check if strain is favorited
  const isFavorite = React.useCallback(
    (strain: Strain): boolean => {
      return Boolean(
        favoriteIds.has(strain.id) ||
          (strain.slug && favoriteIds.has(strain.slug))
      );
    },
    [favoriteIds]
  );

  // Create toggle handler factory
  const createToggleHandler = React.useCallback(
    (strain: Strain) => {
      return () => {
        if (!isHydrated) return;
        const isFav = isFavorite(strain);
        if (!isFav) {
          void addFavorite(strain);
        } else {
          void removeFavorite(strain.id);
        }
      };
    },
    [isHydrated, isFavorite, addFavorite, removeFavorite]
  );

  return {
    favoriteIds,
    isFavorite,
    createToggleHandler,
  };
}
