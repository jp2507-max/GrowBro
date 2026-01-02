import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';

type FormSectionProps = {
  icon?: string;
  title: string;
  children: React.ReactNode;
  delay?: number;
  testID?: string;
};

export function FormSection({
  icon,
  title,
  children,
  delay = 0,
  testID = 'form-section',
}: FormSectionProps): React.ReactElement {
  return (
    <Animated.View
      entering={FadeIn.delay(delay)
        .duration(300)
        .reduceMotion(ReduceMotion.System)}
      className="mt-8 gap-3"
      testID={testID}
    >
      {/* Section Header */}
      <View className="flex-row items-center gap-2.5 px-1">
        {icon ? (
          <View className="size-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40">
            <Text className="text-base">{icon}</Text>
          </View>
        ) : null}
        <Text className="text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
          {title}
        </Text>
      </View>

      {/* Section Content */}
      <View className="overflow-hidden rounded-2xl border border-neutral-300/50 bg-white shadow-sm dark:border-neutral-700/50 dark:bg-charcoal-900">
        {React.Children.map(children, (child, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <View className="mx-4 h-px bg-neutral-100 dark:bg-neutral-800" />
            )}
            {child}
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}
