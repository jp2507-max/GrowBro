/**
 * useCardAnimation - Card press animation hook
 * Provides scale animation for card press interactions
 */

import { useCallback, useEffect } from 'react';
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

export function useCardAnimation(
  resetKey?: string | number
): UseCardAnimationReturn {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  useEffect(() => {
    scale.set(1);
  }, [resetKey, scale]);

  const onPressIn = useCallback(() => {
    scale.set(
      withSpring(0.98, {
        damping: 15,
        stiffness: 350,
        reduceMotion: ReduceMotion.System,
      })
    );
    haptics.selection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPressOut = useCallback(() => {
    scale.set(
      withSpring(1, {
        damping: 15,
        stiffness: 350,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { animatedStyle, onPressIn, onPressOut };
}
