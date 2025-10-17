/**
 * Offline Banner Component
 *
 * Displays a persistent banner when the device is offline.
 * Shows cached data indicator and ensures users know CRUD operations will queue.
 *
 * Requirements: 7.4
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

type OfflineBannerProps = {
  variant?: 'persistent' | 'dismissible';
  onDismiss?: () => void;
};

export function OfflineBanner({
  variant = 'persistent',
  onDismiss,
}: OfflineBannerProps): React.ReactElement {
  const { t } = useTranslation();

  const handleDismiss = React.useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  return (
    <View
      className="dark:bg-warning-950 border-b border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-800"
      testID="offline-banner"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2">
          <View className="size-2 rounded-full bg-warning-600" />
          <Text className="flex-1 text-sm font-medium text-warning-900 dark:text-warning-100">
            {t('common.offline_mode')}
          </Text>
        </View>

        {variant === 'dismissible' && onDismiss && (
          <Text
            onPress={handleDismiss}
            className="ml-2 text-sm font-medium text-warning-700 dark:text-warning-300"
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            accessibilityHint={t('accessibility.dismiss_banner_hint')}
          >
            {t('common.dismiss')}
          </Text>
        )}
      </View>

      <Text className="mt-1 text-xs text-warning-700 dark:text-warning-200">
        {t('inventory.offline_description')}
      </Text>
    </View>
  );
}
