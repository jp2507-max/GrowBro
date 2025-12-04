/**
 * Strains Layout
 *
 * Stack navigator for strains screens.
 * Supports navigation to strain details and favorites.
 * Handles favorites hydration from WatermelonDB on mount.
 */

import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useFavorites } from '@/lib/strains/use-favorites';
import { useFavoritesAutoSync } from '@/lib/strains/use-favorites-auto-sync';

export default function StrainsLayout(): React.ReactElement {
  const { t } = useTranslation();
  const hydrate = useFavorites.use.hydrate();

  // Enable auto-sync when network is available
  useFavoritesAutoSync();

  // Hydrate favorites from local DB on mount
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('tabs.strains'),
        }}
      />
      <Stack.Screen
        name="favorites"
        options={{
          title: t('strains.favorites.title'),
        }}
      />
      <Stack.Screen
        name="[slug]"
        options={{
          title: t('tabs.strains'),
        }}
      />
    </Stack>
  );
}
