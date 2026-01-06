/**
 * GlassButton - Pressable with iOS 26+ Liquid Glass background
 *
 * Used for header buttons, floating back buttons, and icon actions
 * that should have the glass effect on supported devices.
 */

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { GlassSurface } from '@/components/shared/glass-surface';

type GlassButtonVariant = 'circular' | 'pill';

type GlassButtonProps = {
  /** Callback when button is pressed. */
  onPress: () => void;
  /** Button shape variant. Defaults to 'circular'. */
  variant?: GlassButtonVariant;
  /** Size of the button (width/height for circular, height for pill). Defaults to 40. */
  size?: number;
  /** Additional style for the button container. */
  style?: StyleProp<ViewStyle>;
  /** Fallback background style when glass is unavailable. */
  fallbackClassName?: string;
  /** Accessibility label for the button. */
  accessibilityLabel: string;
  /** Accessibility hint for the button. */
  accessibilityHint?: string;
  /** Test ID for testing. */
  testID?: string;
  /** Whether the button is disabled. */
  disabled?: boolean;
  /** Hit slop for touch area. */
  hitSlop?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
  /** Children (typically an icon). */
  children: React.ReactNode;
};

const DEFAULT_SIZE = 40;
const DEFAULT_FALLBACK_CLASS = 'bg-white/15';

export function GlassButton({
  onPress,
  variant = 'circular',
  size = DEFAULT_SIZE,
  style,
  fallbackClassName = DEFAULT_FALLBACK_CLASS,
  accessibilityLabel,
  accessibilityHint,
  testID,
  disabled = false,
  hitSlop,
  children,
}: GlassButtonProps): React.ReactElement {
  const containerStyle = React.useMemo((): ViewStyle => {
    if (variant === 'circular') {
      return {
        width: size,
        height: size,
        borderRadius: size / 2,
      };
    }
    // Pill variant
    return {
      height: size,
      borderRadius: size / 2,
      paddingHorizontal: size / 2,
    };
  }, [variant, size]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
        style,
      ]}
    >
      <GlassSurface
        glassEffectStyle="clear"
        isInteractive
        style={[styles.surface, containerStyle]}
        fallbackClassName={fallbackClassName}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    // No additional styles needed; the GlassSurface handles appearance
  },
  pressed: {
    opacity: 0.7,
  },
  surface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
