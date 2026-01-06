/**
 * GlassSurface - iOS 26+ Liquid Glass wrapper with fallback
 *
 * Uses `isLiquidGlassAvailable()` to conditionally render:
 * - iOS 26+: GlassView from expo-glass-effect
 * - Otherwise: Plain View with fallback styling
 *
 * Known issue mitigation:
 * - `isInteractive` cannot be toggled after mount; use `key` to remount if needed
 * - Avoid placing under parent opacity animations (expo/expo#41024)
 */

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

type GlassEffectStyle = 'clear' | 'regular';

type GlassSurfaceProps = {
  /** Glass effect style (iOS 26+). Defaults to 'regular'. */
  glassEffectStyle?: GlassEffectStyle;
  /** Whether the surface should respond to touch (buttons). Defaults to false. */
  isInteractive?: boolean;
  /** React Native style for dimensions, border radius, padding, etc. */
  style?: StyleProp<ViewStyle>;
  /** Fallback style when glass is unavailable. Applied to the plain View. */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** Fallback className when glass is unavailable. */
  fallbackClassName?: string;
  /** Children to render inside the surface. */
  children?: React.ReactNode;
  /** Test ID for testing. */
  testID?: string;
  /** Pointer events behavior. */
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
  /** Accessibility role for screen readers. */
  accessibilityRole?:
    | 'none'
    | 'button'
    | 'link'
    | 'header'
    | 'search'
    | 'image'
    | 'text'
    | 'adjustable'
    | 'imagebutton'
    | 'summary'
    | 'alert';
  /** Accessibility hint for screen readers. */
  accessibilityHint?: string;
};

const glassAvailable = isLiquidGlassAvailable();

export function GlassSurface({
  glassEffectStyle = 'regular',
  isInteractive = false,
  style,
  fallbackStyle,
  fallbackClassName,
  children,
  testID,
  pointerEvents,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
}: GlassSurfaceProps): React.ReactElement {
  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        style={style}
        testID={testID}
        pointerEvents={pointerEvents}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback for Android + iOS < 26
  return (
    <View
      style={[style, fallbackStyle]}
      className={fallbackClassName}
      testID={testID}
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
    >
      {children}
    </View>
  );
}

export { glassAvailable as isGlassAvailable };
