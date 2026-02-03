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
      className="gap-2"
      testID={testID}
    >
      {/* Section Header */}
      <View className="flex-row items-center gap-2 px-1">
        {icon ? <Text className="text-base">{icon}</Text> : null}
        <Text className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          {title}
        </Text>
      </View>

      {/* Section Content - Glass card styling with green contrast */}
      <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.06]">
        {children}
      </View>
    </Animated.View>
  );
}
