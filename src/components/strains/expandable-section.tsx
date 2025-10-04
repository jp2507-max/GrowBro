import * as React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable, Text, View } from '@/components/ui';

type Props = {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  testID?: string;
};

export const ExpandableSection = React.memo<Props>(
  ({ title, children, defaultExpanded = false, testID }) => {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
    const rotation = useSharedValue(defaultExpanded ? 180 : 0);

    const toggleExpanded = React.useCallback(() => {
      setIsExpanded((prev) => {
        const next = !prev;
        rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
        return next;
      });
    }, [rotation]);

    const chevronStyle = useAnimatedStyle(
      () => ({
        transform: [{ rotate: `${rotation.value}deg` }],
      }),
      []
    );

    return (
      <View
        className="mx-4 mb-4 overflow-hidden rounded-2xl bg-white dark:bg-neutral-900"
        testID={testID}
      >
        <Pressable
          onPress={toggleExpanded}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityHint={
            isExpanded
              ? 'Double-tap to collapse section'
              : 'Double-tap to expand section'
          }
          className="flex-row items-center justify-between p-4"
          testID={`${testID}-header`}
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </Text>
          <Animated.View style={chevronStyle}>
            <Text className="text-lg text-neutral-600 dark:text-neutral-400">
              ⌄
            </Text>
          </Animated.View>
        </Pressable>
        {isExpanded ? (
          <View className="px-4 pb-4" testID={`${testID}-content`}>
            {children}
          </View>
        ) : null}
      </View>
    );
  }
);

ExpandableSection.displayName = 'ExpandableSection';
