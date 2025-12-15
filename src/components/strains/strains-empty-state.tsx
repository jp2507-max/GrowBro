import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  query: string;
  showOfflineNotice: boolean;
};

export function StrainsEmptyState({
  query,
  showOfflineNotice,
}: Props): React.ReactElement {
  const hasQuery = query.length > 0;

  if (hasQuery) {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 px-6 py-12"
        testID="strains-empty-state"
        accessibilityRole="summary"
      >
        {showOfflineNotice ? (
          <Text className="text-center text-sm text-warning-700 dark:text-warning-200">
            {translate('strains.offline_notice')}
          </Text>
        ) : null}
        <Text className="text-center text-base text-text-secondary">
          {translate('strains.no_results')}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center gap-6 px-6 py-12"
      testID="strains-empty-state-educational"
      accessibilityRole="summary"
    >
      <Animated.View
        entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
        className="items-center gap-4"
      >
        <Text
          className="text-center text-xl font-semibold text-text-primary"
          tx="strains.empty_state_educational.title"
        />

        {showOfflineNotice && (
          <View className="dark:bg-primary-950 w-full rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800">
            <Text
              className="text-center text-sm text-primary-700 dark:text-primary-200"
              tx="strains.empty_state_educational.offline_banner"
            />
          </View>
        )}

        <View className="w-full gap-3">
          <Text
            className="text-base font-medium text-text-primary"
            tx="strains.empty_state_educational.search_tip_1"
          />
          <Text
            className="text-base font-medium text-text-primary"
            tx="strains.empty_state_educational.search_tip_2"
          />
          <Text
            className="text-base font-medium text-text-primary"
            tx="strains.empty_state_educational.search_tip_3"
          />
        </View>
      </Animated.View>
    </View>
  );
}
