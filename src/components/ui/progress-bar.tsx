import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';

import colors from '@/components/ui/colors';

type Props = {
  initialProgress?: number;
  className?: string;
};

export type ProgressBarRef = {
  setProgress: (value: number) => void;
};

export const ProgressBar = forwardRef<ProgressBarRef, Props>(
  ({ initialProgress = 0, className = '' }, ref) => {
    const progress = useSharedValue<number>(initialProgress ?? 0);
    useImperativeHandle(ref, () => {
      return {
        setProgress: (value: number) => {
          progress.value = withTiming(value, {
            duration: 250,
            easing: Easing.inOut(Easing.quad),
          });
        },
      };
    }, [progress]);

    const style = useAnimatedStyle(
      () => ({
        width: `${progress.value}%`,
        backgroundColor: colors.black,
        height: 2,
      }),
      []
    );
    return (
      <View className={twMerge('bg-neutral-200', className)}>
        <Animated.View style={style} />
      </View>
    );
  }
);
