/**
 * Premium Pagination Dots Component
 * Morphing indicators with circle → pill animation for active dot
 * Trail effect: previous dots briefly highlight
 */

import React from 'react';
import Reanimated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';

const Animated = Reanimated;

// Dot constants
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;
const DOT_INACTIVE = colors.neutral[400];
const DOT_ACTIVE = colors.primary[600];
const DOT_TRAIL = colors.primary[400]; // Trail effect color

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
    const distance = Math.abs(activeIndex.value - index);

    // Width: morphs from circle (8px) to pill (24px) when active
    const width = interpolate(
      distance,
      [0, 0.5, 1],
      [DOT_ACTIVE_WIDTH, DOT_SIZE + 4, DOT_SIZE],
      Extrapolation.CLAMP
    );

    // Scale: active dot is full size, inactive dots scale down
    const scale = interpolate(
      distance,
      [0, 1, 2],
      [1, 0.7, 0.6],
      Extrapolation.CLAMP
    );

    // Color: active → trail → inactive based on distance
    // Creates a smooth trail effect as you scroll
    const backgroundColor = interpolateColor(
      distance,
      [0, 0.5, 1.5],
      [DOT_ACTIVE, DOT_TRAIL, DOT_INACTIVE]
    );

    return {
      width,
      backgroundColor,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={rStyle}
      className="mx-1 h-2 rounded-full"
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
