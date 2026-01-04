/**
 * ComplianceBanner - Dismissible slim banner for community compliance notice
 *
 * Features:
 * - Slim, non-intrusive design
 * - Dismissible with persisted state via MMKV
 * - Subtle warning colors that don't dominate the feed
 */

import { useColorScheme } from 'nativewind';
import React from 'react';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { X } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import { storage, STORAGE_KEYS } from '@/lib/storage';

type ComplianceBannerProps = {
  testID?: string;
};

export function ComplianceBanner({
  testID = 'compliance-banner',
}: ComplianceBannerProps): React.ReactElement | null {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isDismissed, setIsDismissed] = React.useState(() => {
    return (
      storage.getBoolean(STORAGE_KEYS.COMMUNITY_COMPLIANCE_DISMISSED) ?? false
    );
  });

  const handleDismiss = React.useCallback(() => {
    storage.set(STORAGE_KEYS.COMMUNITY_COMPLIANCE_DISMISSED, true);
    setIsDismissed(true);
  }, []);

  if (isDismissed) {
    return null;
  }

  return (
    <Animated.View
      exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
      testID={testID}
    >
      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-900/20">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {translate('cannabis.educational_short')}
          </Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={translate('common.dismiss')}
          accessibilityHint={translate('common.close')}
          testID={`${testID}-dismiss`}
          className="size-8 items-center justify-center rounded-full active:bg-amber-200/50 dark:active:bg-amber-800/30"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X
            size={16}
            color={isDark ? colors.warning[300] : colors.warning[700]}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * Reset the banner dismissed state (useful for testing or settings)
 */
export function resetComplianceBanner(): void {
  storage.delete(STORAGE_KEYS.COMMUNITY_COMPLIANCE_DISMISSED);
}
