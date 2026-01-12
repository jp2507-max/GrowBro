/**
 * Animated Hero Component
 * Premium animated hero icon with floating motion and pulsing glow
 * For onboarding slides
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  // @ts-expect-error - Reanimated 4.1.2: withDelay type export missing
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';

type AnimatedHeroProps = {
  emoji: string;
  bgClassName: string;
  testID?: string;
};

export function AnimatedHero({
  emoji,
  bgClassName,
  testID = 'animated-hero',
}: AnimatedHeroProps): React.ReactElement {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0.3);

  React.useEffect(() => {
    // Entrance spring
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
      mass: 0.8,
      reduceMotion: ReduceMotion.System,
    });

    // Continuous float animation
    translateY.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-8, {
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0, {
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );

    // Pulsing glow
    glowOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.6, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0.3, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );
  }, [translateY, scale, glowOpacity]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View testID={testID} className="items-center justify-center">
      {/* Glow layer */}
      <Animated.View
        style={[styles.glowBase, glowStyle]}
        className={bgClassName}
      />

      {/* Icon container */}
      <Animated.View
        style={iconStyle}
        className={`size-28 items-center justify-center rounded-3xl shadow-xl ${bgClassName}`}
      >
        <Text className="text-6xl">{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowBase: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 24,
    transform: [{ scale: 1.3 }],
    // The blur is simulated via larger size + opacity
  },
});
