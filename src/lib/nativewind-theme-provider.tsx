/**
 * NativeWind Theme Provider - Modern Organic Tech
 *
 * Uses NativeWind's `vars()` function to inject CSS variables at runtime.
 * Light Mode: Clean gallery feel with white space
 * Dark Mode: Deep forest with subtle borders for premium depth
 */
import { useColorScheme, vars } from 'nativewind';
import React from 'react';
import { View } from 'react-native';

import colors from '@/components/ui/colors';

const themes = {
  light: vars({
    // BACKGROUNDS - Morning Mist Green
    '--color-background': colors.neutral[50], // #F2F9F6 - Minz-Weiß
    '--color-card': colors.white,
    '--color-card-highlight': colors.primary[50], // Für aktive Elemente

    // BORDERS & DIVIDERS - sichtbar aber soft
    '--color-border': colors.neutral[200], // #CCEBD9 - sanftes Grün

    // TEXT - Deep Forest statt kaltem Schwarz
    '--color-text-primary': '#022C22', // Deep Jungle - fast schwarz aber warm
    '--color-text-secondary': colors.neutral[600], // #376558 - Waldgrün
    '--color-text-tertiary': colors.neutral[500], // #4A8A6B
    '--color-text-inverse': colors.white,
    '--color-text-brand': colors.primary[700], // Für Headlines wie "Canabro"

    // ACTIONS (Buttons & Links)
    '--color-action-primary': colors.primary[600], // Navigation / Icons
    '--color-action-primary-hover': colors.primary[700],
    '--color-action-cta': colors.terracotta[500], // Der "Gießen"-Button
    '--color-action-cta-text': colors.white,

    // FOCUS
    '--color-focus-ring': colors.primary[400],

    // STATUS (Badges)
    '--color-status-success-bg': colors.primary[100],
    '--color-status-success-text': colors.primary[800],

    // SELECTION (Modal options - Soft Organic)
    '--color-selection-bg': colors.primary[50],
    '--color-selection-border': colors.primary[100],
    '--color-selection-text': colors.primary[900],
    '--color-selection-check': colors.primary[600],
  }),

  dark: vars({
    // BACKGROUNDS
    '--color-background': '#050B09', // Ein Hauch von Grün im Schwarz (Deep Forest)
    '--color-card': '#121C18', // Leichter Kontrast zum Background
    '--color-card-highlight': '#1A2622',

    // BORDERS (Der Premium Trick für Dark Mode)
    '--color-border': '#23332D', // Definierte Kanten statt verschwommene Flächen

    // TEXT
    '--color-text-primary': '#F0FDF4', // Ein sehr kühles Weiß (Mint-Hauch)
    '--color-text-secondary': '#94A3B8', // Gute Lesbarkeit
    '--color-text-tertiary': '#475569',
    '--color-text-inverse': '#050B09',
    '--color-text-brand': colors.primary[400],

    // ACTIONS
    '--color-action-primary': colors.primary[500], // Heller für "Glow" Effekt
    '--color-action-primary-hover': colors.primary[600],
    '--color-action-cta': colors.terracotta[500], // Poppt extrem gut auf Dunkel
    '--color-action-cta-text': colors.white,

    // FOCUS
    '--color-focus-ring': colors.primary[300],

    // STATUS
    '--color-status-success-bg': 'rgba(16, 185, 129, 0.15)', // Modern Glassy Look
    '--color-status-success-text': colors.primary[300],

    // SELECTION (Modal options - Soft Organic)
    '--color-selection-bg': 'rgba(16, 185, 129, 0.12)', // Glassy primary
    '--color-selection-border': 'rgba(16, 185, 129, 0.25)',
    '--color-selection-text': colors.primary[200],
    '--color-selection-check': colors.primary[400],
  }),
};

type NativeWindThemeProviderProps = {
  children: React.ReactNode;
};

export function NativeWindThemeProvider({
  children,
}: NativeWindThemeProviderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  // Fallback auf Light, falls undefined
  const themeVars = colorScheme === 'dark' ? themes.dark : themes.light;

  return (
    <View style={[{ flex: 1 }, themeVars]} className={colorScheme}>
      {children}
    </View>
  );
}
