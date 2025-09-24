import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);
const BTN_WIDTH = 125;
const BTN_HEIGHT = 50;
const DURATION = 200;

export function ComposeBtn({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  const { netHeight, grossHeight } = useBottomTabBarHeight();
  const { listOffsetY, offsetYAnchorOnBeginDrag, scrollDirection } =
    useAnimatedScrollList();

  const rContainerStyle = useAnimatedStyle(() => {
    if (
      listOffsetY.value >= offsetYAnchorOnBeginDrag.value &&
      scrollDirection.value === 'to-bottom'
    ) {
      return {
        width: withTiming(BTN_HEIGHT, { duration: DURATION }),
        height: withTiming(BTN_HEIGHT, { duration: DURATION }),
        transform: [
          { translateY: withTiming(netHeight, { duration: DURATION }) },
        ],
      };
    }
    return {
      width: withTiming(BTN_WIDTH, { duration: DURATION }),
      height: withTiming(BTN_HEIGHT, { duration: DURATION }),
      transform: [{ translateY: withTiming(0, { duration: DURATION }) }],
    };
  });

  const rTextStyle = useAnimatedStyle(() => {
    if (
      listOffsetY.value >= offsetYAnchorOnBeginDrag.value &&
      scrollDirection.value === 'to-bottom'
    ) {
      return { opacity: withTiming(0, { duration: DURATION / 2 }) };
    }
    return { opacity: withTiming(1, { duration: DURATION }) };
  });

  return (
    <AnimatedPressable
      activeOpacity={0.9}
      className="absolute right-6 flex-row items-center justify-center gap-3 rounded-full bg-neutral-800 px-4 shadow-md"
      style={[rContainerStyle, { bottom: grossHeight + 16 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('community.create_post')}
    >
      <Text className="text-base text-primary-300" style={rTextStyle}>
        {translate('community.create_post')}
      </Text>
    </AnimatedPressable>
  );
}
