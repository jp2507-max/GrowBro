/**
 * Strains Layout
 *
 * Stack navigator for strains screens.
 * Supports navigation to strain details and favorites.
 * Handles favorites hydration from WatermelonDB on mount.
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useFavorites } from '@/lib/strains/use-favorites';
import { useFavoritesAutoSync } from '@/lib/strains/use-favorites-auto-sync';
import { themeRoles } from '@/lib/theme-tokens';

export default function StrainsLayout(): React.ReactElement {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const hydrate = useFavorites.use.hydrate();

  // Enable auto-sync when network is available
  useFavoritesAutoSync();

  // Hydrate favorites from local DB on mount
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      headerStyle: {
        backgroundColor: isDark
          ? themeRoles.surface.dark.background
          : themeRoles.surface.light.background,
      },
      headerTintColor: isDark
        ? themeRoles.text.dark.primary
        : themeRoles.text.light.primary,
      headerTitleStyle: {
        fontFamily: Platform.select({ ios: 'Inter', android: 'Inter' }),
        fontWeight: '600' as const,
        fontSize: 17,
        color: isDark
          ? themeRoles.text.dark.primary
          : themeRoles.text.light.primary,
      },
      headerLargeTitleStyle: {
        fontFamily: Platform.select({ ios: 'Inter', android: 'Inter' }),
        fontWeight: '700' as const,
        color: isDark
          ? themeRoles.text.dark.primary
          : themeRoles.text.light.primary,
      },
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      contentStyle: {
        backgroundColor: isDark
          ? themeRoles.surface.dark.background
          : themeRoles.surface.light.background,
      },
    }),
    [isDark]
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
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
