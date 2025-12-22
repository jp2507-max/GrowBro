import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onConvertToTask?: () => void;
};

export function CalendarEmptyState({
  onConvertToTask,
}: Props): React.ReactElement {
  return (
    <View
      testID="calendar-empty-state"
      className="flex-1 items-center justify-center gap-6 px-6 py-12"
    >
      <Animated.View
        entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
        className="items-center gap-4"
      >
        <Text
          className="text-center text-xl font-semibold text-charcoal-900 dark:text-neutral-100"
          tx="calendar.empty_state.title"
        />

        <View className="bg-card w-full gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-charcoal-700">
          <Text
            className="text-text-primary text-base font-medium"
            tx="calendar.empty_state.sample_title"
          />
          <Text
            className="text-sm text-neutral-600 dark:text-neutral-400"
            tx="calendar.empty_state.sample_description"
          />
        </View>
      </Animated.View>

      {onConvertToTask && (
        <Animated.View
          entering={FadeIn.duration(300)
            .delay(150)
            .reduceMotion(ReduceMotion.System)}
        >
          <Button
            label={translate('calendar.empty_state.convert_to_task')}
            onPress={onConvertToTask}
            accessibilityHint={translate('calendar.empty_state.action_hint')}
            accessibilityRole="button"
            testID="calendar-empty-state-convert"
          />
        </Animated.View>
      )}
    </View>
  );
}
