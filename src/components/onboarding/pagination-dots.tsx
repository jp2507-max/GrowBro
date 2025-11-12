/**
 * Pagination Dots Component
 * Based on makeitanimated pattern: components/pagination-dots.tsx
 *
 * Dots whose backgroundColor interpolates around the active index
 */

import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import { colors } from '@/components/ui/colors';

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
  const rStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      [colors.neutral[400], colors.primary[600], colors.neutral[400]]
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
