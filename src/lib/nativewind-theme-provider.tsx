/**
 * NativeWind Theme Provider
 *
 * Uses NativeWind's `vars()` function to inject CSS variables at runtime.
 * This is required because NativeWind processes styles at build time and
 * doesn't support static CSS variables from global.css.
 */
import { useColorScheme, vars } from 'nativewind';
import React from 'react';
import { View } from 'react-native';

import colors from '@/components/ui/colors';

// Define theme tokens using NativeWind's vars() function
const themes = {
  light: vars({
    '--color-background': colors.neutral[50], // #FFFBF0 - Warm cream
    '--color-card': colors.white, // #ffffff
    '--color-border': colors.neutral[200], // #F0E6CC
    '--color-text-primary': colors.ink[900], // #233838
    '--color-text-secondary': colors.ink[700], // #385C5C
    '--color-text-inverse': colors.white,
    '--color-action-primary': colors.primary[600], // #7AA47A
    '--color-action-primary-hover': colors.primary[700],
    '--color-action-cta': colors.terracotta[500],
    '--color-focus-ring': colors.primary[400],
  }),
  dark: vars({
    '--color-background': colors.charcoal[950], // #121212
    '--color-card': colors.charcoal[850], // #2E2E2E
    '--color-border': colors.charcoal[700], // #474747
    '--color-text-primary': colors.charcoal[100], // #E5E5E5
    '--color-text-secondary': colors.charcoal[400], // #969696
    '--color-text-inverse': colors.charcoal[950],
    '--color-action-primary': colors.primary[300],
    '--color-action-primary-hover': colors.primary[400],
    '--color-action-cta': colors.terracotta[400],
    '--color-focus-ring': colors.primary[300],
  }),
};

type NativeWindThemeProviderProps = {
  children: React.ReactNode;
};

export function NativeWindThemeProvider({
  children,
}: NativeWindThemeProviderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const themeVars = colorScheme === 'dark' ? themes.dark : themes.light;

  return (
    <View style={[{ flex: 1 }, themeVars]} className={colorScheme}>
      {children}
    </View>
  );
}
