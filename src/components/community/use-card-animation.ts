/**
 * useCardAnimation - Press animation for post cards
 */
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  reduceMotion: ReduceMotion.System,
};

type CardAnimationReturn = {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
};

export function useCardAnimation(
  _postId: number | string
): CardAnimationReturn {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  return { animatedStyle, onPressIn, onPressOut };
}
