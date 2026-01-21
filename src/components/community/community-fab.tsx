/**
 * CommunityFab - Floating Action Button for creating new posts
 *
 * A clean, terracotta-colored FAB that sits at the bottom-right of the community feed.
 * Uses the terracotta color palette for strong CTA guidance as per design system.
 */

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { HelpCircle, Plus } from '@/components/ui/icons';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const fabStyles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: colors.terracotta[700],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  helpShadow: {
    ...Platform.select({
      ios: {
        shadowColor: colors.sky[600],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});

type CommunityMode = 'showcase' | 'help';

type CommunityFabProps = {
  onPress: () => void;
  mode?: CommunityMode;
  testID?: string;
};

export function CommunityFab({
  onPress,
  mode = 'showcase',
  testID = 'community-fab',
}: CommunityFabProps): React.ReactElement {
  const { grossHeight } = useBottomTabBarHeight();
  const scale = useSharedValue(1);
  const isHelpMode = mode === 'help';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = React.useCallback(() => {
    scale.set(
      withSpring(0.85, {
        damping: 12,
        stiffness: 450,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.set(
      withSequence(
        withSpring(1.08, {
          damping: 8,
          stiffness: 350,
          reduceMotion: ReduceMotion.System,
        }),
        withDelay(
          80,
          withSpring(1, {
            damping: 10,
            stiffness: 300,
            reduceMotion: ReduceMotion.System,
          })
        )
      )
    );
  }, [scale]);

  const handlePress = React.useCallback(() => {
    haptics.medium();
    onPress();
  }, [onPress]);

  const accessibilityLabel = isHelpMode
    ? translate('community.help_mode.fab_label')
    : translate('community.create_post');
  const accessibilityHint = isHelpMode
    ? translate('community.help_mode.fab_hint')
    : translate('accessibility.community.compose_hint');

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      className={`absolute right-6 size-14 items-center justify-center rounded-full ${
        isHelpMode ? 'bg-sky-500' : 'bg-terracotta-500'
      }`}
      style={[
        animatedStyle,
        isHelpMode ? fabStyles.helpShadow : fabStyles.shadow,
        { bottom: grossHeight + 32 },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View className="items-center justify-center">
        {isHelpMode ? (
          <HelpCircle size={24} color={colors.white} />
        ) : (
          <Plus size={24} color={colors.white} />
        )}
      </View>
    </AnimatedPressable>
  );
}
