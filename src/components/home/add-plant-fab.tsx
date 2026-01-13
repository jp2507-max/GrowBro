import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Pressable, Text } from '@/components/ui';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

const FAB_MARGIN = 16;

const SPRING_CONFIG_PRESS = {
  damping: 12,
  stiffness: 400,
  mass: 0.6,
  reduceMotion: ReduceMotion.System,
};

const SPRING_CONFIG_RELEASE = {
  damping: 8,
  stiffness: 300,
  mass: 0.5,
  reduceMotion: ReduceMotion.System,
};

export function AddPlantFab(): React.ReactElement {
  const router = useRouter();
  const { grossHeight } = useBottomTabBarHeight();
  const scale = useSharedValue(1);

  const handlePressIn = React.useCallback((): void => {
    haptics.selection();
    scale.value = withSpring(0.85, SPRING_CONFIG_PRESS);
  }, [scale]);

  const handlePressOut = React.useCallback((): void => {
    scale.value = withSpring(1.05, SPRING_CONFIG_RELEASE);
    setTimeout(() => {
      scale.value = withSpring(1, SPRING_CONFIG_RELEASE);
    }, 80);
  }, [scale]);

  const handlePress = React.useCallback((): void => {
    router.push('/plants/create');
  }, [router]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const positionStyle = React.useMemo(
    () => ({
      bottom: grossHeight + FAB_MARGIN,
      right: FAB_MARGIN,
    }),
    [grossHeight]
  );

  return (
    <Animated.View style={[styles.container, positionStyle, animatedStyle]}>
      <Pressable
        className="size-14 items-center justify-center rounded-full bg-primary-600 shadow-xl active:bg-primary-700"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={translate('home.fab.add_plant' as TxKeyPath)}
        accessibilityHint={translate('home.fab.hint' as TxKeyPath)}
        testID="add-plant-fab"
      >
        <Text className="text-3xl font-light leading-8 text-white">+</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
});
