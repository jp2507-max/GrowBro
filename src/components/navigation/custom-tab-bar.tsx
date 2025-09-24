import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Pressable } from '@/components/ui';
import {
  Feed as FeedIcon,
  Home as HomeIcon,
  Style as StyleIcon,
  TopDress as PlantsIcon,
} from '@/components/ui/icons';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const DURATION = 300;

export function CustomTabBar({
  navigation,
  state: _state,
}: BottomTabBarProps): React.ReactElement {
  const { grossHeight } = useBottomTabBarHeight();
  const { listOffsetY, offsetYAnchorOnBeginDrag, scrollDirection } =
    useAnimatedScrollList();

  const rContainerStyle = useAnimatedStyle(() => {
    if (
      listOffsetY.value >= offsetYAnchorOnBeginDrag.value &&
      scrollDirection.value === 'to-bottom'
    ) {
      return { bottom: withTiming(-grossHeight, { duration: DURATION }) };
    }
    return { bottom: withTiming(0, { duration: DURATION }) };
  });

  return (
    <Animated.View
      className="absolute inset-x-0 bottom-0 flex-row bg-neutral-900"
      style={[rContainerStyle, { height: grossHeight }]}
    >
      <Pressable
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate('(app)')}
      >
        <HomeIcon />
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate('calendar')}
      >
        <StyleIcon />
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate('community')}
      >
        <FeedIcon />
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate('plants')}
      >
        <PlantsIcon />
      </Pressable>
    </Animated.View>
  );
}
