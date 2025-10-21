/**
 * Flagger Analytics Dashboard Component
 * Displays trusted flagger performance metrics and quality analytics
 * Requirements: 11.1, 11.2, 11.3, 11.5
 */

import React from 'react';
import { ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import { formatResponseTime } from '@/lib/moderation/trusted-flagger-analytics';
import type { TrustedFlaggerAnalytics } from '@/types/moderation';

import { FlaggerCard } from './flagger-card';

type Props = {
  analytics: TrustedFlaggerAnalytics;
  onFlaggerPress?: (flaggerId: string) => void;
  testID?: string;
};

export function FlaggerAnalyticsDashboard({
  analytics,
  onFlaggerPress,
  testID = 'flagger-analytics',
}: Props) {
  // Main render: a vertically scrollable layout. The structure is two-level:
  // 1) A small row of summary cards showing aggregate metrics for all flaggers.
  // 2) A list of individual flagger cards that show per-flagger metrics and
  //    an optional action to view details.
  return (
    <ScrollView className="flex-1" testID={testID}>
      {/* Summary Cards: quick aggregates that give a high-level overview. */}
      <View className="mb-6 flex-row gap-4">
        {/* Total Flaggers: shows total and number currently active. */}
        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Total Flaggers
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {analytics.total_flaggers}
          </Text>
          <Text className="text-xs text-success-600 dark:text-success-400">
            {analytics.active_flaggers} active
          </Text>
        </View>

        {/* Average accuracy across all flaggers (displayed as percent). */}
        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Avg Accuracy
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {(analytics.aggregate_metrics.average_accuracy * 100).toFixed(1)}%
          </Text>
        </View>

        {/* Average response time formatted via helper. */}
        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Avg Response
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatResponseTime(
              analytics.aggregate_metrics.average_response_time_ms
            )}
          </Text>
        </View>

        {/* Reports per month – useful for volume-tracking and trend detection. */}
        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Reports/Month
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {analytics.aggregate_metrics.total_reports_this_month}
          </Text>
        </View>
      </View>

      {/* Individual Flagger Cards: iterate over each trusted flagger and show
          name, id (shortened), status badge, metric grid, volume and footer
          with last reviewed date and optional action. */}
      <View className="gap-3">
        {analytics.flaggers.map((flagger) => (
          <FlaggerCard
            key={flagger.flagger_id}
            flagger={flagger}
            onFlaggerPress={onFlaggerPress}
          />
        ))}
      </View>
    </ScrollView>
  );
}
