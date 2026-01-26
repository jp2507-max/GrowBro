import { Stack } from 'expo-router';
import React from 'react';

import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { hydrateFavorites } from '@/lib/strains/use-favorites';
import { useFavoritesAutoSync } from '@/lib/strains/use-favorites-auto-sync';

export const unstable_settings = {
  index: { anchor: 'index' },
  community: { anchor: 'community/index' },
  strains: { anchor: 'strains/index' },
  calendar: { anchor: 'calendar' },
};

type SharedLayoutProps = {
  segment: string;
};

function getAnchorSegment(segment: string): string {
  const match = segment.match(/\((.*)\)/);
  return match?.[1] ?? segment;
}

const ROUTE_MAP: Record<string, string> = {
  index: 'index',
  community: 'community/index',
  strains: 'strains/index',
  calendar: 'calendar',
};

export default function SharedTabsLayout({
  segment,
}: SharedLayoutProps): React.ReactElement {
  const screen = getAnchorSegment(segment);
  const isStrainsStack = screen === 'strains';
  const routeName = ROUTE_MAP[screen] ?? 'index';

  useFavoritesAutoSync({ enabled: isStrainsStack });

  React.useEffect(() => {
    if (!isStrainsStack) return;
    hydrateFavorites().catch((error) => {
      // Log or report (e.g., Sentry) so failures are visible.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[favorites] hydrate failed', error);
      }
      captureCategorizedErrorSync(error, { context: 'hydrateFavorites' });
    });
  }, [isStrainsStack]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name={routeName} />
    </Stack>
  );
}
