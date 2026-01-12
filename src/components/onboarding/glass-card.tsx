/**
 * Glass Card Component
 * Premium glassmorphism card with spring animation for onboarding
 */

import React from 'react';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  // @ts-ignore - Reanimated 4.x type exports issue
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

type GlassCardProps = {
  index: number;
  testID: string;
  icon: string;
  iconBg: string;
  titleKey: TxKeyPath;
  bodyKey: TxKeyPath;
};

export function GlassCard({
  index,
  testID,
  icon,
  iconBg,
  titleKey,
  bodyKey,
}: GlassCardProps): React.ReactElement {
  const scale = useSharedValue(0.85);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    const delay = 200 + index * 100;

    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 14,
        stiffness: 120,
        mass: 0.8,
        reduceMotion: ReduceMotion.System,
      })
    );

    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 14,
        stiffness: 120,
        mass: 0.8,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale, translateY, index]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.delay(200 + index * 100)
        .duration(300)
        .reduceMotion(ReduceMotion.System)}
      style={cardStyle}
      className="flex-row items-center rounded-2xl border border-white/20 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-charcoal-900/70"
    >
      <View
        className={`mr-4 size-12 items-center justify-center rounded-xl ${iconBg}`}
      >
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-charcoal-950 dark:text-white">
          {translate(titleKey)}
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {translate(bodyKey)}
        </Text>
      </View>
    </Animated.View>
  );
}
