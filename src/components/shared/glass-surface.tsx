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

import type { BlurTint } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { OptionalBlurView } from '@/components/shared/optional-blur-view';

type GlassEffectStyle = 'clear' | 'regular';

export type GlassSurfaceProps = {
  /** Glass effect style (iOS 26+). Defaults to 'regular'. */
  glassEffectStyle?: GlassEffectStyle;
  /** Blur fallback intensity (iOS < 26, Android). Defaults to 80. */
  blurIntensity?: number;
  /** Blur fallback tint (iOS < 26, Android). Defaults to 'systemMaterial'. */
  blurTint?: BlurTint;
  /** Whether blur should render when glass isn't available. Defaults to true. */
  blurEnabled?: boolean;
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
const DEFAULT_BLUR_INTENSITY = 80;
const DEFAULT_BLUR_TINT: BlurTint = 'systemMaterial';
const DEFAULT_FALLBACK_CLASS = 'bg-white/15 dark:bg-black/20';
const DEFAULT_RADIUS = 16;

export function GlassSurface({
  glassEffectStyle = 'regular',
  blurIntensity = DEFAULT_BLUR_INTENSITY,
  blurTint = DEFAULT_BLUR_TINT,
  blurEnabled = true,
  isInteractive = false,
  style,
  fallbackStyle,
  fallbackClassName = DEFAULT_FALLBACK_CLASS,
  children,
  testID,
  pointerEvents,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
}: GlassSurfaceProps): React.ReactElement {
  const surfaceStyle = React.useMemo<StyleProp<ViewStyle>>(
    () => [styles.surface, style],
    [style]
  );

  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        style={surfaceStyle}
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
      style={[surfaceStyle, fallbackStyle]}
      className={fallbackClassName}
      testID={testID}
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
    >
      {blurEnabled ? (
        <OptionalBlurView
          intensity={blurIntensity}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

export { glassAvailable as isGlassAvailable };

const styles = StyleSheet.create({
  surface: {
    borderRadius: DEFAULT_RADIUS,
    overflow: 'hidden',
  },
});
