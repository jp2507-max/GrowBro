import * as React from 'react';

import { useStrain } from '@/api';
import { FavoriteButton as BaseFavoriteButton } from '@/components/strains/favorite-button';
import { useFavorites } from '@/lib/strains/use-favorites';
import type { Strain } from '@/types/strains';

type Props = {
  strainId: string;
  /** Pass strain directly to avoid re-fetching (e.g., when used inside StrainCard) */
  strain?: Strain;
  testID?: string;
  /** Use 'overlay' for detail screen header with blurred background */
  variant?: 'default' | 'overlay';
};

/**
 * FavoriteButton wrapper that integrates with favorites store
 * Handles fetching strain data and toggling favorite state
 */
export const FavoriteButtonConnected = React.memo<Props>(
  ({ strainId, strain: strainProp, testID, variant }) => {
    // Only fetch if strain not provided as prop
    const { data: fetchedStrain } = useStrain({
      strainIdOrSlug: strainId,
      enabled: !strainProp,
    });
    const strain = strainProp ?? fetchedStrain;

    const isHydrated = useFavorites((state) => state.isHydrated);
    const hydrate = useFavorites.use.hydrate();
    const addFavorite = useFavorites.use.addFavorite();
    const removeFavorite = useFavorites.use.removeFavorite();
    const slug = strain?.slug;
    const isFav = useFavorites(
      React.useCallback(
        (state) =>
          Boolean(
            state.favorites[strainId] ??
              (slug ? state.favorites[slug] : undefined)
          ),
        [strainId, slug]
      )
    );

    // Ensure favorites are hydrated from local DB
    React.useEffect(() => {
      if (!isHydrated) {
        void hydrate();
      }
    }, [isHydrated, hydrate]);

    const handleToggle = React.useCallback(() => {
      if (!isHydrated) return;
      if (!isFav) {
        if (!strain) return;
        void addFavorite(strain);
      } else {
        const state = useFavorites.getState().favorites;
        const favoriteById = state[strainId];
        const favoriteBySlug = slug ? state[slug] : undefined;
        const targetId = favoriteById?.id ?? favoriteBySlug?.id ?? strainId;
        void removeFavorite(targetId);
      }
    }, [
      isFav,
      isHydrated,
      slug,
      strainId,
      strain,
      addFavorite,
      removeFavorite,
    ]);

    return (
      <BaseFavoriteButton
        isFavorite={isFav}
        onToggle={handleToggle}
        testID={testID}
        variant={variant}
      />
    );
  }
);

FavoriteButtonConnected.displayName = 'FavoriteButtonConnected';
