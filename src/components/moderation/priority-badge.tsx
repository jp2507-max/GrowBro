/**
 * Priority Badge Component
 * Displays report priority level with color coding
 * Requirements: 2.1, 2.2
 */

import React from 'react';

import { Text, View } from '@/components/ui';
import {
  getPriorityColors,
  getPriorityLabel,
} from '@/lib/moderation/sla-indicators';

type Props = {
  priority: string;
  testID?: string;
};

export function PriorityBadge({ priority, testID = 'priority-badge' }: Props) {
  const { bg, text } = getPriorityColors(priority);
  const label = getPriorityLabel(priority);

  return (
    <View
      className={`rounded-full px-2.5 py-1 ${bg}`}
      testID={testID}
      accessibilityLabel={`Priority: ${label}`}
      accessibilityHint="Report priority level"
    >
      <Text className={`text-xs font-bold ${text}`}>{label}</Text>
    </View>
  );
}
