import React, { forwardRef, useImperativeHandle } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';

import colors from '@/components/ui/colors';

const BAR_HEIGHT = 2;
const BAR_COLOR = colors.black;

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
    const containerWidth = useSharedValue(0);
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

    const handleLayout = React.useCallback(
      (event: LayoutChangeEvent): void => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== containerWidth.value) {
          containerWidth.value = width;
        }
      },
      [containerWidth]
    );

    const style = useAnimatedStyle(() => {
      const width = containerWidth.value;
      const clamped = Math.min(100, Math.max(0, progress.value));
      const scaleX = clamped / 100;
      const translateX = width ? -(width * (1 - scaleX)) / 2 : 0;
      return {
        width,
        height: BAR_HEIGHT,
        backgroundColor: BAR_COLOR,
        transform: [{ translateX }, { scaleX }],
      };
    }, []);
    return (
      <View
        className={twMerge('bg-neutral-200', className)}
        onLayout={handleLayout}
      >
        <Animated.View style={style} />
      </View>
    );
  }
);
