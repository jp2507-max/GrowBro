import * as React from 'react';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { OfflineMode } from '@/lib/auth';

interface OfflineModeBannerProps {
  mode: OfflineMode;
  onDismiss?: () => void;
}

export function OfflineModeBanner({ mode, onDismiss }: OfflineModeBannerProps) {
  // Don't show banner for full access mode
  if (mode === 'full') {
    return null;
  }

  const isReadonly = mode === 'readonly';

  return (
    <View
      className={`mx-4 my-2 rounded-lg p-4 ${
        isReadonly
          ? 'bg-warning-100 dark:bg-warning-900'
          : 'bg-danger-100 dark:bg-danger-900'
      }`}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text
            className={`font-semibold ${
              isReadonly
                ? 'text-warning-900 dark:text-warning-100'
                : 'text-danger-900 dark:text-danger-100'
            }`}
          >
            {translate(
              isReadonly
                ? 'auth.offline_readonly_title'
                : 'auth.offline_blocked_title'
            )}
          </Text>
          <Text
            className={`mt-1 text-sm ${
              isReadonly
                ? 'text-warning-800 dark:text-warning-200'
                : 'text-danger-800 dark:text-danger-200'
            }`}
          >
            {translate(
              isReadonly
                ? 'auth.offline_readonly_message'
                : 'auth.offline_blocked_message'
            )}
          </Text>
        </View>

        {isReadonly && onDismiss && (
          <Pressable
            onPress={onDismiss}
            className="ml-3 rounded-full p-2"
            accessibilityRole="button"
            accessibilityLabel={translate('common.dismiss')}
            accessibilityHint="Dismisses this offline notification"
          >
            <Text className="text-xl text-warning-900 dark:text-warning-100">
              ×
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
