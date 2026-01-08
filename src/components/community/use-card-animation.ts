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

export function useCardAnimation() {
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
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale]);

  return { animatedStyle, onPressIn, onPressOut };
}
