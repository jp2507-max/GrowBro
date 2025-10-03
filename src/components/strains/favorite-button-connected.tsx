import * as React from 'react';

import { useStrain } from '@/api';
import { FavoriteButton as BaseFavoriteButton } from '@/components/strains/favorite-button';
import { useFavorites } from '@/lib/strains/use-favorites';

type Props = {
  strainId: string;
  testID?: string;
};

/**
 * FavoriteButton wrapper that integrates with favorites store
 * Handles fetching strain data and toggling favorite state
 */
export const FavoriteButtonConnected = React.memo<Props>(
  ({ strainId, testID }) => {
    const { data: strain } = useStrain({ variables: { strainId } });
    const isFavorite = useFavorites.use.isFavorite();
    const addFavorite = useFavorites.use.addFavorite();
    const removeFavorite = useFavorites.use.removeFavorite();

    const isFav = React.useMemo(() => {
      return isFavorite(strainId);
    }, [isFavorite, strainId]);

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
      />
    );
  }
);

FavoriteButtonConnected.displayName = 'FavoriteButtonConnected';
