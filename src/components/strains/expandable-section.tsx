import * as React from 'react';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

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

    const toggleExpanded = React.useCallback((): void => {
      setIsExpanded((prev) => {
        const next = !prev;
        rotation.set(
          withTiming(next ? 180 : 0, {
            duration: 200,
            reduceMotion: ReduceMotion.System,
          })
        );
        return next;
      });
    }, [rotation]);

    const chevronStyle = useAnimatedStyle(
      () => ({
        transform: [{ rotate: `${rotation.get()}deg` }],
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
              ? translate('accessibility.common.collapse_section_hint')
              : translate('accessibility.common.expand_section_hint')
          }
          className="flex-row items-center justify-between p-4"
          testID={testID ? `${testID}-header` : undefined}
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
          <View
            className="px-4 pb-4"
            testID={testID ? `${testID}-content` : undefined}
          >
            {children}
          </View>
        ) : null}
      </View>
    );
  }
);

ExpandableSection.displayName = 'ExpandableSection';
