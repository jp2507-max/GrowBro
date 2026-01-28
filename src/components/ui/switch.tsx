import { useColorScheme } from 'nativewind';
import React, { useCallback } from 'react';
import {
  Platform,
  Switch as NativeSwitch,
  type SwitchProps as NativeSwitchProps,
} from 'react-native';

import colors from '@/components/ui/colors';
import { haptics } from '@/lib/haptics';

export interface SwitchProps extends NativeSwitchProps {
  className?: string; // For compatibility with NativeWind if needed, though mostly styled via props
}

export function Switch({
  value,
  onValueChange,
  disabled,
  trackColor,
  thumbColor,
  ios_backgroundColor,
  className,
  ...props
}: SwitchProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleValueChange = useCallback(
    (val: boolean) => {
      // Trigger selection haptic for consistent feedback
      haptics.selection();
      onValueChange?.(val);
    },
    [onValueChange]
  );

  // Default colors based on brand palette
  // On iOS, we use the system default colors to preserve the "liquid glass" native look
  const activeTrackColor =
    Platform.OS === 'ios'
      ? undefined
      : isDark
        ? colors.primary[500]
        : colors.primary[600];

  const inactiveTrackColor =
    Platform.OS === 'ios'
      ? undefined
      : isDark
        ? colors.charcoal[700]
        : colors.neutral[200];

  // Thumb: White (Standard) or can be branded if needed. Standard native look usually white thumb.
  const defaultThumbColor = Platform.OS === 'ios' ? undefined : colors.white;

  const nativeProps: NativeSwitchProps = {
    value,
    onValueChange: handleValueChange,
    disabled,
    ...props,
  };

  // On iOS, specifying ANY trackColor (even with undefined values) can sometimes trigger
  // a flat rendering mode instead of the native "liquid glass" look.
  // We only inject brand colors on non-iOS platforms or if widely needed.
  if (Platform.OS !== 'ios') {
    nativeProps.trackColor = {
      false: trackColor?.false ?? inactiveTrackColor,
      true: trackColor?.true ?? activeTrackColor,
    };
    nativeProps.thumbColor = thumbColor ?? defaultThumbColor;
  } else {
    // On iOS, only pass if user explicitly provided overrides
    if (trackColor) {
      nativeProps.trackColor = trackColor;
    }
    if (thumbColor) {
      nativeProps.thumbColor = thumbColor;
    }
    if (ios_backgroundColor) {
      nativeProps.ios_backgroundColor = ios_backgroundColor;
    }
  }

  return <NativeSwitch className={className} {...nativeProps} />;
}
