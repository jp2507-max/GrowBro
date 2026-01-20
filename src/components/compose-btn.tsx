import React from 'react';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable, Text } from '@/components/ui';
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedText = Animated.createAnimatedComponent(Text);
const BTN_WIDTH = 125;
const BTN_HEIGHT = 50;
const DURATION = 200;
const COLLAPSED_SCALE_X = BTN_HEIGHT / BTN_WIDTH;
const COLLAPSED_TRANSLATE_X = (BTN_WIDTH - BTN_HEIGHT) / 2;

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

  const collapseProgress = useSharedValue(0);
  const collapseTarget = useSharedValue(0);

  useDerivedValue(() => {
    const nextTarget = isHiddenOrCollapsed.value ? 1 : 0;
    if (collapseTarget.value !== nextTarget) {
      collapseTarget.value = nextTarget;
      collapseProgress.value = withTiming(nextTarget, {
        duration: DURATION,
        reduceMotion: ReduceMotion.System,
      });
    }
  });

  const rContainerStyle = useAnimatedStyle(() => {
    const clamped = Math.min(Math.max(collapseProgress.value, 0), 1);
    const scaleX = 1 - (1 - COLLAPSED_SCALE_X) * clamped;
    const translateX = COLLAPSED_TRANSLATE_X * clamped;
    const translateY = netHeight * clamped;
    return {
      width: BTN_WIDTH,
      height: BTN_HEIGHT,
      transform: [
        { scaleX },
        { translateX },
        {
          translateY,
        },
      ],
    };
  }, [netHeight]);

  const rTextStyle = useAnimatedStyle(() => {
    const clamped = Math.min(Math.max(collapseProgress.value, 0), 1);
    return {
      opacity: 1 - clamped,
    };
  }, []);

  return (
    <AnimatedPressable
      className="absolute right-6 flex-row items-center justify-center gap-3 rounded-full bg-neutral-800 px-4 shadow-md"
      style={({ pressed }: { pressed: boolean }) => [
        rContainerStyle,
        { bottom: grossHeight + 16 },
        pressed && { opacity: 0.9 },
      ]}
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
