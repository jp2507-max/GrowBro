/**
 * Slide Container Component
 * Based on makeitanimated pattern: components/slide-container.tsx
 *
 * Crossfade wrapper for slide groups: opacity interpolates around center index
 */

import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { crossfadeAroundIndex } from '@/lib/animations/primitives';

type SlideContainerProps = {
  children: React.ReactNode;
  index: number;
  activeIndex: SharedValue<number>;
  window?: number;
  testID?: string;
};

export function SlideContainer({
  children,
  index,
  activeIndex,
  window = 0.5,
  testID,
}: SlideContainerProps): React.ReactElement {
  const rStyle = useAnimatedStyle(() => {
    const opacity = crossfadeAroundIndex({
      activeIndex,
      centerIndex: index,
      window,
    });
    return { opacity };
  });

  return (
    <Animated.View
      style={rStyle}
      className="flex-1 items-center justify-center px-6"
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}
