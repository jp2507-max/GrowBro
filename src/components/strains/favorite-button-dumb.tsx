import * as React from 'react';

import { FavoriteButton as BaseFavoriteButton } from '@/components/strains/favorite-button';

type Props = {
  isFavorite: boolean;
  onToggle: () => void;
  testID?: string;
  /** Use 'overlay' for detail screen header with blurred background */
  variant?: 'default' | 'overlay';
};

/**
 * Presentational favorite button - no store subscription.
 * Receives isFavorite state and onToggle callback from parent.
 */
export const FavoriteButtonDumb = React.memo<Props>(
  ({ isFavorite, onToggle, testID, variant }) => {
    return (
      <BaseFavoriteButton
        isFavorite={isFavorite}
        onToggle={onToggle}
        testID={testID}
        variant={variant}
      />
    );
  }
);

FavoriteButtonDumb.displayName = 'FavoriteButtonDumb';
