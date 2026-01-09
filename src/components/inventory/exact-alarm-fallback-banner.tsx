import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Settings } from '@/components/ui/icons/settings';
import { withRM } from '@/lib/animations/motion';
import { ExactAlarmCoordinator } from '@/lib/inventory/notifications/exact-alarm-coordinator';

type ExactAlarmFallbackBannerProps = {
  onDismiss: () => void;
  testID?: string;
};

/**
 * In-app banner shown when SCHEDULE_EXACT_ALARM permission is denied.
 * Informs users that notifications may be delayed and offers link to Settings.
 *
 * @see Requirements 4.2 (Android 13+ notification handling - fallback UX)
 */
export function ExactAlarmFallbackBanner({
  onDismiss,
  testID = 'exact-alarm-fallback-banner',
}: ExactAlarmFallbackBannerProps) {
  const { t } = useTranslation();

  const handleOpenSettings = useCallback(async () => {
    try {
      await ExactAlarmCoordinator.openAppSettings();
    } catch (error) {
      console.error('Error opening exact alarm settings:', error);
    }
  }, []);

  return (
    <Animated.View
      className="mx-4 mb-4 overflow-hidden rounded-xl bg-warning-50 dark:bg-warning-900/20"
      entering={withRM(FadeIn.duration(300))}
      exiting={withRM(FadeOut.duration(200))}
      testID={testID}
    >
      <View className="flex-row items-start gap-3 p-4">
        {/* Icon - Using emoji as fallback */}
        <Text className="text-lg">⚠️</Text>

        {/* Content */}
        <View className="flex-1 gap-1">
          <Text className="font-inter-semibold text-sm text-warning-900 dark:text-warning-100">
            {t('inventory.permissions.exactAlarm.fallbackTitle')}
          </Text>
          <Text className="text-xs text-warning-800 dark:text-warning-200">
            {t('inventory.permissions.exactAlarm.fallbackBody')}
          </Text>

          {/* Settings link */}
          <Pressable
            onPress={handleOpenSettings}
            className="mt-2 flex-row items-center gap-1.5"
            testID={`${testID}-settings-button`}
            accessibilityRole="button"
            accessibilityLabel={t(
              'inventory.permissions.exactAlarm.openSettings'
            )}
            accessibilityHint={t(
              'inventory.permissions.exactAlarm.openSettingsHint'
            )}
          >
            <Settings width={14} height={14} color={colors.warning[700]} />
            <Text className="font-inter-semibold text-xs text-warning-700 dark:text-warning-300">
              {t('inventory.permissions.exactAlarm.openSettings')}
            </Text>
          </Pressable>
        </View>

        {/* Dismiss button */}
        <Pressable
          onPress={onDismiss}
          className="p-1"
          testID={`${testID}-dismiss-button`}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alarm banner"
          accessibilityHint="Closes the alarm fallback banner"
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
        >
          <Text className="text-base text-warning-700">✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
