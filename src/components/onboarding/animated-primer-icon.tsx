/**
 * Animated Primer Icon Component
 * Premium animated icon with floating motion and glow effect
 * Matches AnimatedLottieHero aesthetic for permission primer screens
 */

import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  // @ts-ignore - Reanimated 4.x type exports issue
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';

type AnimationValues = {
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  glowOpacity: SharedValue<number>;
};

function usePrimerIconAnimation(): AnimationValues {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.2);

  React.useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.ease),
      reduceMotion: ReduceMotion.System,
    });
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 80,
      mass: 1,
      reduceMotion: ReduceMotion.System,
    });
    translateY.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-6, {
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0, {
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );
    glowOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.4, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0.2, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(glowOpacity);
    };
  }, [translateY, scale, opacity, glowOpacity]);

  return { translateY, scale, opacity, glowOpacity };
}

type AnimatedPrimerIconProps = {
  icon: React.ReactNode;
  variant?: 'primary' | 'success';
  testID?: string;
};

export function AnimatedPrimerIcon({
  icon,
  variant = 'primary',
  testID = 'animated-primer-icon',
}: AnimatedPrimerIconProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateY, scale, opacity, glowOpacity } = usePrimerIconAnimation();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const glowColor =
    variant === 'success'
      ? isDark
        ? colors.success[500]
        : colors.success[200]
      : isDark
        ? colors.primary[500]
        : colors.primary[200];
  const outerBgClass =
    variant === 'success'
      ? 'bg-success-100 dark:bg-success-900/30'
      : 'bg-primary-100 dark:bg-primary-900/30';
  const innerBgClass =
    variant === 'success'
      ? 'bg-success-600 dark:bg-success-500'
      : 'bg-primary-600 dark:bg-primary-500';

  return (
    <View testID={testID} className="items-center justify-center">
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          { backgroundColor: glowColor } as ViewStyle,
        ]}
      />
      <Animated.View style={animatedStyle}>
        <View
          className={`size-24 items-center justify-center rounded-full ${outerBgClass}`}
        >
          <View
            className={`size-16 items-center justify-center rounded-full ${innerBgClass}`}
          >
            {icon}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
});
