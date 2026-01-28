import { useColorScheme } from 'nativewind';
import React, { forwardRef, useImperativeHandle } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import colors from '@/components/ui/colors';
import { cn } from '@/lib/utils';

const BAR_HEIGHT = 2;

type Props = {
  initialProgress?: number;
  className?: string;
};

export type ProgressBarRef = {
  setProgress: (value: number) => void;
};

export const ProgressBar = forwardRef<ProgressBarRef, Props>(
  ({ initialProgress = 0, className = '' }, ref) => {
    const { colorScheme } = useColorScheme();
    const progress = useSharedValue<number>(initialProgress ?? 0);
    const containerWidth = useSharedValue(0);
    useImperativeHandle(ref, () => {
      return {
        setProgress: (value: number) => {
          progress.set(
            withTiming(
              value,
              {
                duration: 250,
                easing: Easing.inOut(Easing.quad),
                reduceMotion: ReduceMotion.System,
              },
              undefined
            )
          );
        },
      };
    }, [progress]);

    const handleLayout = React.useCallback(
      (event: LayoutChangeEvent): void => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== containerWidth.get()) {
          containerWidth.set(width);
        }
      },
      [containerWidth]
    );

    const style = useAnimatedStyle(() => {
      const width = containerWidth.get();
      const clamped = Math.min(100, Math.max(0, progress.get()));
      const scaleX = clamped / 100;
      const translateX = width ? -(width * (1 - scaleX)) / 2 : 0;
      const barColor =
        colorScheme === 'dark' ? colors.neutral[50] : colors.black;
      return {
        width,
        height: BAR_HEIGHT,
        backgroundColor: barColor,
        transform: [{ translateX }, { scaleX }],
      };
    }, [colorScheme]);
    return (
      <View
        className={cn('bg-neutral-200 dark:bg-white/10', className)}
        onLayout={handleLayout}
      >
        <Animated.View style={style} />
      </View>
    );
  }
);
