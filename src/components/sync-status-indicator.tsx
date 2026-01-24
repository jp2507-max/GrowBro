/**
 * Sync Status Indicator Component
 * Visual feedback for offline/syncing/online state
 */

import * as React from 'react';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib/i18n/utils';
import { useReduceMotionEnabled } from '@/lib/strains/accessibility';
import type { SyncState } from '@/lib/sync/types';

type Props = {
  state: SyncState;
  pendingChanges?: number;
  compact?: boolean;
};

const getStateConfig = (state: SyncState, pendingChanges: number) => {
  switch (state) {
    case 'syncing':
      return {
        icon: '⟳',
        text: translate('sync.status.syncing'),
        color: 'text-primary-600',
        bgColor: 'bg-primary-50',
      };
    case 'offline':
      return {
        icon: '⚠',
        text:
          pendingChanges > 0
            ? translate('sync.status.offline_pending', {
                count: pendingChanges,
              })
            : translate('sync.status.offline'),
        color: 'text-warning-600',
        bgColor: 'bg-warning-50',
      };
    case 'error':
      return {
        icon: '✕',
        text: translate('sync.status.error'),
        color: 'text-danger-600',
        bgColor: 'bg-danger-50',
      };
    default:
      return null;
  }
};

/**
 * Sync Status Indicator
 * Shows current sync state with icon and text
 */
export function SyncStatusIndicator({
  state,
  pendingChanges = 0,
  compact = false,
}: Props) {
  const opacity = useSharedValue(1);
  const reduceMotion = useReduceMotionEnabled();

  React.useEffect(() => {
    cancelAnimation(opacity);
    if (reduceMotion) {
      opacity.set(1);
      return;
    }

    if (state === 'syncing') {
      // Pulse animation when syncing
      opacity.set(
        withRepeat(
          withSequence(
            withTiming(0.5, {
              duration: 600,
              reduceMotion: ReduceMotion.System,
            }),
            withTiming(1, {
              duration: 600,
              reduceMotion: ReduceMotion.System,
            })
          ),
          -1,
          true
        )
      );
    } else {
      opacity.set(
        withTiming(1, {
          duration: 300,
          reduceMotion: ReduceMotion.System,
        })
      );
    }
    return () => {
      cancelAnimation(opacity);
    };
  }, [state, opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  const config = getStateConfig(state, pendingChanges);

  // Don't show indicator when idle and no pending changes
  if (!config) {
    return null;
  }

  if (compact) {
    return (
      <Animated.View
        style={animatedStyle}
        className={`rounded-full px-2 py-1 ${config.bgColor}`}
      >
        <Text className={`text-xs font-medium ${config.color}`}>
          {config.icon}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={animatedStyle}
      className={`flex-row items-center gap-2 rounded-lg px-3 py-2 ${config.bgColor}`}
    >
      <Text className={`text-base ${config.color}`}>{config.icon}</Text>
      <Text className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </Text>
    </Animated.View>
  );
}

type BannerProps = {
  state: SyncState;
  pendingChanges?: number;
  onRetry?: () => void;
};

/**
 * Sync Status Banner
 * Full-width banner for prominent sync state display
 */
export function SyncStatusBanner({
  state,
  pendingChanges = 0,
  onRetry,
}: BannerProps) {
  if (state === 'idle') {
    return null;
  }

  const getConfig = () => {
    switch (state) {
      case 'syncing':
        return {
          message: translate('accessibility.sync.banner.syncing_title'),
          bgColor: 'bg-primary-50',
          textColor: 'text-primary-900',
        };
      case 'offline':
        return {
          message:
            pendingChanges > 0
              ? translate('accessibility.sync.banner.offline_message_other', {
                  count: pendingChanges,
                })
              : translate('accessibility.sync.banner.offline_title'),
          bgColor: 'bg-warning-50',
          textColor: 'text-warning-900',
        };
      case 'error':
        return {
          message: translate('accessibility.sync.banner.error_message_other', {
            count: 1,
          }),
          bgColor: 'bg-danger-50',
          textColor: 'text-danger-900',
        };
    }
  };

  const config = getConfig();

  return (
    <View className={`px-4 py-3 ${config.bgColor}`}>
      <View className="flex-row items-center justify-between">
        <Text className={`flex-1 text-sm ${config.textColor}`}>
          {config.message}
        </Text>
        {state === 'error' && onRetry && (
          <Text
            className="ml-2 text-sm font-medium text-primary-600"
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={translate('sync.status.retry_button_label')}
            // NOTE: the key 'common.retry_hint' does not exist in our translations.
            // The defined key is 'accessibility.common.retry_hint' (see src/translations/en.json).
            // Using the wrong key causes i18next to fall back to the raw key string,
            // which may be announced by screen readers (regression for SR users).
            // Fix: point to the accessibility namespace so screen readers get the proper hint.
            accessibilityHint={translate(
              'accessibility.common.retry_hint' as TxKeyPath
            )}
            tx="common.retry"
          />
        )}
      </View>
    </View>
  );
}
