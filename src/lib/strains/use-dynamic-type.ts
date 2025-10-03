/**
 * Hook for dynamic type scaling support
 * Supports up to 200% text scaling for accessibility
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Font size scale based on window width and accessibility settings
 */
export function useDynamicType() {
  const { fontScale } = useWindowDimensions();

  // Cap at 200% (2.0) for layout stability
  const cappedFontScale = useMemo(() => Math.min(fontScale, 2.0), [fontScale]);

  // Calculate scaled sizes for common text styles
  const scaledSizes = useMemo(
    () => ({
      xs: Math.round(12 * cappedFontScale),
      sm: Math.round(14 * cappedFontScale),
      base: Math.round(16 * cappedFontScale),
      lg: Math.round(18 * cappedFontScale),
      xl: Math.round(20 * cappedFontScale),
      '2xl': Math.round(24 * cappedFontScale),
      '3xl': Math.round(30 * cappedFontScale),
    }),
    [cappedFontScale]
  );

  // Determine if we're in large text mode (>150%)
  const isLargeTextMode = cappedFontScale > 1.5;

  // Determine if we're at maximum scale (200%)
  const isMaxScale = cappedFontScale >= 2.0;

  return {
    fontScale: cappedFontScale,
    scaledSizes,
    isLargeTextMode,
    isMaxScale,
    // Helper to scale any size
    scale: (size: number) => Math.round(size * cappedFontScale),
  };
}

/**
 * Get responsive spacing based on font scale
 * Increases spacing in large text mode for better readability
 */
export function useResponsiveSpacing() {
  const { isLargeTextMode } = useDynamicType();

  return useMemo(
    () => ({
      // Base spacing units (in pixels)
      xs: isLargeTextMode ? 6 : 4,
      sm: isLargeTextMode ? 10 : 8,
      md: isLargeTextMode ? 18 : 16,
      lg: isLargeTextMode ? 28 : 24,
      xl: isLargeTextMode ? 40 : 32,

      // Card padding
      cardPadding: isLargeTextMode ? 20 : 16,

      // List item spacing
      listItemGap: isLargeTextMode ? 12 : 8,

      // Badge spacing
      badgeGap: isLargeTextMode ? 8 : 6,

      // Scale any custom spacing
      scale: (size: number) => Math.round(size * (isLargeTextMode ? 1.25 : 1)),
    }),
    [isLargeTextMode]
  );
}

/**
 * Get line height multiplier for better readability
 */
export function useLineHeight() {
  const { isLargeTextMode } = useDynamicType();

  return useMemo(
    () => ({
      tight: isLargeTextMode ? 1.3 : 1.25,
      normal: isLargeTextMode ? 1.6 : 1.5,
      relaxed: isLargeTextMode ? 1.8 : 1.75,
      loose: isLargeTextMode ? 2.0 : 1.875,
    }),
    [isLargeTextMode]
  );
}
