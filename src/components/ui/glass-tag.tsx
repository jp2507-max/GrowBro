/**
 * GlassTag - Small pill tag with iOS 26+ Liquid Glass background
 *
 * Used for image overlays, strain cards, and badge surfaces.
 */

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/shared/glass-surface';
import { Text } from '@/components/ui/text';

type GlassTagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

type GlassTagProps = {
  /** Label text to display. */
  label: string;
  /** Tone/color variant. Defaults to 'neutral'. */
  tone?: GlassTagTone;
  /** Optional left icon (React element). */
  leftIcon?: React.ReactNode;
  /** Additional style for the tag. */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing. */
  testID?: string;
  /** Accessibility label for screen readers. Defaults to label. */
  accessibilityLabel?: string;
};

const TONE_CLASSES: Record<GlassTagTone, { fallback: string; text: string }> = {
  neutral: {
    fallback: 'bg-black/40',
    text: 'text-white dark:text-neutral-50',
  },
  primary: {
    fallback: 'bg-primary-600/60',
    text: 'text-white dark:text-primary-100',
  },
  success: {
    fallback: 'bg-emerald-600/60',
    text: 'text-white dark:text-emerald-100',
  },
  warning: {
    fallback: 'bg-amber-500/60',
    text: 'text-white dark:text-amber-100',
  },
  danger: {
    fallback: 'bg-red-600/60',
    text: 'text-white dark:text-red-100',
  },
};

export function GlassTag({
  label,
  tone = 'neutral',
  leftIcon,
  style,
  testID,
  accessibilityLabel,
}: GlassTagProps): React.ReactElement {
  const toneConfig = TONE_CLASSES[tone];

  return (
    <GlassSurface
      glassEffectStyle="clear"
      style={[styles.tag, style]}
      fallbackClassName={toneConfig.fallback}
      testID={testID}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="text"
    >
      <View className="flex-row items-center gap-1 px-2.5 py-1">
        {leftIcon}
        <Text className={`text-xs font-semibold ${toneConfig.text}`}>
          {label}
        </Text>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
