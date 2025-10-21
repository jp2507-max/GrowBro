/**
 * Queue Item Component
 * Individual report card in moderator queue with SLA and priority indicators
 * Requirements: 2.1, 2.2, 2.3
 */

import { router } from 'expo-router';
import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import type { QueuedReport } from '@/types/moderation';

import { PriorityBadge } from './priority-badge';
import { SLABadge } from './sla-badge';

type Props = {
  report: QueuedReport;
  testID?: string;
};

export function QueueItem({ report, testID = 'queue-item' }: Props) {
  const handlePress = () => {
    router.push(`/(moderator)/report/${report.id}`);
  };

  const reportCategory =
    report.report_type === 'illegal' ? 'Illegal Content' : 'ToS Violation';
  const reporterType = report.trusted_flagger ? 'Trusted Flagger' : 'User';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Review report ${report.id.slice(0, 8)}`}
      accessibilityHint="Tap to open report details"
      className="mb-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800"
      testID={testID}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Report #{report.id.slice(0, 8)}
          </Text>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {reportCategory} · {reporterType}
          </Text>
        </View>
        <SLABadge
          status={report.sla_status}
          deadline={new Date(report.sla_deadline)}
        />
      </View>

      <Text
        className="mb-3 text-sm text-neutral-700 dark:text-neutral-300"
        numberOfLines={2}
      >
        {report.explanation}
      </Text>

      <View className="flex-row items-center justify-between">
        <PriorityBadge
          priority={
            report.priority >= 90
              ? 'immediate'
              : report.priority >= 70
                ? 'illegal'
                : report.priority >= 50
                  ? 'trusted'
                  : 'standard'
          }
        />
        {report.similar_decisions.length > 0 && (
          <Text className="text-xs text-primary-600 dark:text-primary-400">
            {report.similar_decisions.length} similar
          </Text>
        )}
      </View>
    </Pressable>
  );
}
