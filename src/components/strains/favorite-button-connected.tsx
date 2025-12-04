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
      strainId,
      enabled: !strainProp,
    });
    const strain = strainProp ?? fetchedStrain;

    // Subscribe directly to favorites state for reactive updates
    const favorites = useFavorites.use.favorites();
    const addFavorite = useFavorites.use.addFavorite();
    const removeFavorite = useFavorites.use.removeFavorite();

    // Derive isFav from favorites object - this updates reactively
    const isFav = strainId in favorites;

    const handleToggle = React.useCallback(() => {
      if (!isFav) {
        if (!strain) return;
        void addFavorite(strain);
      } else {
        void removeFavorite(strainId);
      }
    }, [isFav, strainId, strain, addFavorite, removeFavorite]);

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
