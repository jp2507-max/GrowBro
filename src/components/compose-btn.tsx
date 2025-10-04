import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedText = Animated.createAnimatedComponent(Text);
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

  const isHiddenOrCollapsed = useDerivedValue(
    () =>
      listOffsetY.value >= offsetYAnchorOnBeginDrag.value &&
      scrollDirection.value === 'to-bottom'
  );

  const rContainerStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(isHiddenOrCollapsed.value ? BTN_HEIGHT : BTN_WIDTH, {
        duration: DURATION,
      }),
      height: withTiming(BTN_HEIGHT, { duration: DURATION }),
      transform: [
        {
          translateY: withTiming(isHiddenOrCollapsed.value ? netHeight : 0, {
            duration: DURATION,
          }),
        },
      ],
    };
  }, [netHeight]);

  const rTextStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isHiddenOrCollapsed.value ? 0 : 1, {
        duration: isHiddenOrCollapsed.value ? DURATION / 2 : DURATION,
      }),
    };
  }, []);

  return (
    <AnimatedPressable
      activeOpacity={0.9}
      className="absolute right-6 flex-row items-center justify-center gap-3 rounded-full bg-neutral-800 px-4 shadow-md"
      style={[rContainerStyle, { bottom: grossHeight + 16 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('community.create_post')}
      accessibilityHint={translate('accessibility.community.compose_hint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <AnimatedText className="text-base text-primary-300" style={rTextStyle}>
        {translate('community.create_post')}
      </AnimatedText>
    </AnimatedPressable>
  );
}
