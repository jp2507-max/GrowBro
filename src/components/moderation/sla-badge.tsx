/**
 * SLA Badge Component
 * Visual indicator for report SLA status with time remaining
 * Requirements: 2.3
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import Animated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { withRM } from '@/lib/animations/motion';
import { formatTimeRemaining } from '@/lib/moderation/sla-calculator';
import {
  getSLAAccessibilityLabel,
  getSLAStatusLabel,
  shouldAnimateIndicator,
  SLA_COLORS,
} from '@/lib/moderation/sla-indicators';
import { useReduceMotionEnabled } from '@/lib/strains/accessibility';
import type { SLAStatus } from '@/types/moderation';

type Props = {
  status: SLAStatus;
  deadline: Date;
  testID?: string;
};

export function SLABadge({ status, deadline, testID = 'sla-badge' }: Props) {
  const { t } = useTranslation();
  const colors = SLA_COLORS[status];
  const rawDelta = deadline.getTime() - Date.now();
  const nonNegDelta = Math.max(0, rawDelta);
  const timeRemaining = formatTimeRemaining(nonNegDelta);
  const isOverdue = rawDelta <= 0;
  const shouldAnimate = shouldAnimateIndicator(status);
  const opacity = useSharedValue(1);
  const reduceMotion = useReduceMotionEnabled();

  React.useEffect(() => {
    if (reduceMotion || !shouldAnimate) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }

    opacity.set(
      withRepeat(
        withSequence(
          withTiming(1, withRM({ duration: 500 })),
          withTiming(0.6, withRM({ duration: 500 }))
        ),
        -1,
        true
      )
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [reduceMotion, shouldAnimate, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return { opacity: opacity.get() };
  });

  return (
    <Animated.View
      style={animatedStyle}
      accessibilityLabel={getSLAAccessibilityLabel(status, timeRemaining, t)}
      accessibilityHint={t('moderation.sla.accessibilityHint')}
      testID={testID}
    >
      <View
        className={`rounded-lg border px-3 py-1.5 ${colors.bg} ${colors.border}`}
      >
        <Text className={`text-xs font-semibold ${colors.text}`}>
          {isOverdue
            ? t('moderation.sla.status.overdue')
            : getSLAStatusLabel(status, t)}
        </Text>
        <Text className={`text-xs ${colors.text}`}>{timeRemaining}</Text>
      </View>
    </Animated.View>
  );
}
