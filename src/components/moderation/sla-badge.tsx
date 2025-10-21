/**
 * SLA Badge Component
 * Visual indicator for report SLA status with time remaining
 * Requirements: 2.3
 */

import React from 'react';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { formatTimeRemaining } from '@/lib/moderation/sla-calculator';
import {
  getSLAAccessibilityLabel,
  getSLAStatusLabel,
  shouldAnimateIndicator,
  SLA_COLORS,
} from '@/lib/moderation/sla-indicators';
import type { SLAStatus } from '@/types/moderation';

type Props = {
  status: SLAStatus;
  deadline: Date;
  testID?: string;
};

export function SLABadge({ status, deadline, testID = 'sla-badge' }: Props) {
  const colors = SLA_COLORS[status];
  const timeRemaining = formatTimeRemaining(deadline.getTime() - Date.now());
  const shouldAnimate = shouldAnimateIndicator(status);

  const animatedStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) return {};
    return {
      opacity: withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.6, { duration: 500 })
        ),
        -1,
        true
      ),
    };
  }, [shouldAnimate]);

  return (
    <Animated.View
      style={animatedStyle}
      accessibilityLabel={getSLAAccessibilityLabel(status, timeRemaining)}
      accessibilityHint="Service level agreement status"
      testID={testID}
    >
      <View
        className={`rounded-lg border px-3 py-1.5 ${colors.bg} ${colors.border}`}
      >
        <Text className={`text-xs font-semibold ${colors.text}`}>
          {getSLAStatusLabel(status)}
        </Text>
        <Text className={`text-xs ${colors.text}`}>{timeRemaining}</Text>
      </View>
    </Animated.View>
  );
}
