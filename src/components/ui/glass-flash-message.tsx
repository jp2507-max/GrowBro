/**
 * GlassFlashMessage - Custom MessageComponent for react-native-flash-message
 *
 * Renders toast notifications with iOS 26+ Liquid Glass background,
 * falling back to translucent styling on unsupported platforms.
 */

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/shared/glass-surface';
import { Text } from '@/components/ui/text';

type FlashMessageType =
  | 'none'
  | 'default'
  | 'info'
  | 'success'
  | 'danger'
  | 'warning';

type MessageComponentProps = {
  message: {
    message: string;
    description?: string;
    type?: FlashMessageType;
    icon?: string | React.ReactNode;
  };
  style?: StyleProp<ViewStyle>;
};

const TYPE_ICONS: Record<FlashMessageType, string> = {
  none: '',
  default: 'ℹ️',
  info: 'ℹ️',
  success: '✓',
  danger: '⚠️',
  warning: '⚠️',
};

const TYPE_FALLBACK_CLASSES: Record<FlashMessageType, string> = {
  none: 'bg-charcoal-900/90 dark:bg-charcoal-800/95',
  default: 'bg-charcoal-900/90 dark:bg-charcoal-800/95',
  info: 'bg-indigo-900/90 dark:bg-indigo-800/95',
  success: 'bg-success-900/90 dark:bg-success-800/95',
  danger: 'bg-danger-900/90 dark:bg-danger-800/95',
  warning: 'bg-warning-900/90 dark:bg-warning-800/95',
};

export function GlassFlashMessage({
  message,
  style,
}: MessageComponentProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const type = message.type ?? 'default';
  const fallbackClass = TYPE_FALLBACK_CLASSES[type];
  const icon = message.icon ?? TYPE_ICONS[type];

  return (
    <View
      style={[styles.wrapper, { paddingTop: insets.top + 8 }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <GlassSurface
        glassEffectStyle="regular"
        style={styles.container}
        fallbackClassName={fallbackClass}
      >
        <View className="flex-row items-start gap-3 px-4 py-3">
          {icon ? (
            <View className="mt-0.5">
              {typeof icon === 'string' ? (
                <Text className="text-lg text-white">{icon}</Text>
              ) : (
                icon
              )}
            </View>
          ) : null}
          <View className="flex-1">
            <Text className="text-base font-semibold text-white">
              {message.message}
            </Text>
            {message.description ? (
              <Text className="mt-0.5 text-sm text-white/80">
                {message.description}
              </Text>
            ) : null}
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
