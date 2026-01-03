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
  withSpring,
} from 'react-native-reanimated';

import { Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Plus } from '@/components/ui/icons';
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
});

type CommunityFabProps = {
  onPress: () => void;
  testID?: string;
};

export function CommunityFab({
  onPress,
  testID = 'community-fab',
}: CommunityFabProps): React.ReactElement {
  const { grossHeight } = useBottomTabBarHeight();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback(() => {
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 400,
      reduceMotion: ReduceMotion.System,
    });
    haptics.selection();
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale]);

  const handlePress = React.useCallback(() => {
    haptics.medium();
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={translate('community.create_post')}
      accessibilityHint={translate('accessibility.community.compose_hint')}
      testID={testID}
      className="absolute right-6 size-14 items-center justify-center rounded-full bg-terracotta-500"
      style={[animatedStyle, fabStyles.shadow, { bottom: grossHeight + 32 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View className="items-center justify-center">
        <Plus size={24} color={colors.white} />
      </View>
    </AnimatedPressable>
  );
}
