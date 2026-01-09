/**
 * Pagination Dots Component
 * Based on makeitanimated pattern: components/pagination-dots.tsx
 *
 * Dots whose backgroundColor interpolates around the active index
 */

import React from 'react';
import Reanimated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';

const Animated = Reanimated;
const DOT_INACTIVE = colors.neutral[400];
const DOT_ACTIVE = colors.primary[600];
const DOT_OUTPUT_RANGE = [DOT_INACTIVE, DOT_ACTIVE, DOT_INACTIVE] as const;

type PaginationDotsProps = {
  count: number;
  activeIndex: SharedValue<number>;
  testID?: string;
};

type DotProps = {
  index: number;
  activeIndex: SharedValue<number>;
};

function Dot({ index, activeIndex }: DotProps): React.ReactElement {
  const inputRange: [number, number, number] = [index - 1, index, index + 1];

  const rStyle = useAnimatedStyle(() => {
    'worklet';
    const backgroundColor = interpolateColor(
      activeIndex.value,
      inputRange,
      DOT_OUTPUT_RANGE
    );
    return { backgroundColor };
  });

  return (
    <Animated.View
      style={rStyle}
      className="mx-1 size-2 rounded-full"
      testID={`pagination-dot-${index}`}
    />
  );
}

export function PaginationDots({
  count,
  activeIndex,
  testID = 'pagination-dots',
}: PaginationDotsProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-center py-4" testID={testID}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} activeIndex={activeIndex} />
      ))}
    </View>
  );
}
