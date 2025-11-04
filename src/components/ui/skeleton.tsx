/**
 * Skeleton loading component
 * Requirements: 2.3, 12.1
 *
 * Provides visual feedback during content loading with smooth animations
 * that respect Reduced Motion settings.
 */

import React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/lib/animations/motion';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
  testID?: string;
};

/**
 * Skeleton loader with shimmer effect
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  className,
  testID,
}: SkeletonProps) {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    // Shimmer animation with Reduced Motion support
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: motion.dur.lg }),
        withTiming(1, { duration: motion.dur.lg })
      ),
      -1, // Infinite repeat
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width,
          height,
          borderRadius,
        },
      ]}
      className={`bg-neutral-200 dark:bg-neutral-800 ${className ?? ''}`}
      testID={testID}
      accessibilityLabel="Loading"
      accessibilityHint="Content is loading, please wait"
      accessibilityRole="progressbar"
    />
  );
}

/**
 * Profile stats skeleton
 */
export function ProfileStatsSkeleton({ testID }: { testID?: string }) {
  return (
    <View className="flex-row justify-around py-4" testID={testID}>
      {[1, 2, 3].map((i) => (
        <View key={i} className="items-center">
          <Skeleton width={40} height={28} borderRadius={8} className="mb-2" />
          <Skeleton width={60} height={16} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

/**
 * Settings list item skeleton
 */
export function SettingsItemSkeleton({ testID }: { testID?: string }) {
  return (
    <View className="flex-row items-center px-4 py-3" testID={testID}>
      <Skeleton width={24} height={24} borderRadius={12} className="mr-3" />
      <View className="flex-1">
        <Skeleton width="60%" height={16} borderRadius={4} className="mb-2" />
        <Skeleton width="40%" height={12} borderRadius={4} />
      </View>
    </View>
  );
}

/**
 * Form field skeleton
 */
export function FormFieldSkeleton({ testID }: { testID?: string }) {
  return (
    <View className="mb-4" testID={testID}>
      <Skeleton width={80} height={14} borderRadius={4} className="mb-2" />
      <Skeleton width="100%" height={44} borderRadius={8} />
    </View>
  );
}
