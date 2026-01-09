/**
 * useCardAnimation - Card press animation hook
 * Provides scale animation for card press interactions
 */

import { useCallback } from 'react';
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

type UseCardAnimationReturn = {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
};

export function useCardAnimation(): UseCardAnimationReturn {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.98, {
      damping: 15,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
    haptics.selection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { animatedStyle, onPressIn, onPressOut };
}
