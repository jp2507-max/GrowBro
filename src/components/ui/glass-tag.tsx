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
};

const TONE_CLASSES: Record<GlassTagTone, { fallback: string; text: string }> = {
  neutral: {
    fallback: 'bg-black/40',
    text: 'text-white',
  },
  primary: {
    fallback: 'bg-primary-600/60',
    text: 'text-white',
  },
  success: {
    fallback: 'bg-emerald-600/60',
    text: 'text-white',
  },
  warning: {
    fallback: 'bg-amber-500/60',
    text: 'text-white',
  },
  danger: {
    fallback: 'bg-red-600/60',
    text: 'text-white',
  },
};

export function GlassTag({
  label,
  tone = 'neutral',
  leftIcon,
  style,
  testID,
}: GlassTagProps): React.ReactElement {
  const toneConfig = TONE_CLASSES[tone];

  return (
    <GlassSurface
      glassEffectStyle="clear"
      style={[styles.tag, style]}
      fallbackClassName={toneConfig.fallback}
      testID={testID}
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
