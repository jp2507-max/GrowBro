import colors from '@/components/ui/colors';

/**
 * Header colors for screen headers with consistent theming.
 * Used by ScreenHeaderBase and other header components.
 */
export const headerColors = {
  light: {
    background: colors.primary[600],
    text: colors.white,
  },
  dark: {
    background: colors.primary[800],
    text: colors.white,
  },
} as const;

/**
 * Get header colors based on the current theme mode
 */
export function getHeaderColors(isDark: boolean) {
  return isDark ? headerColors.dark : headerColors.light;
}
