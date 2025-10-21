/**
 * Flagger Analytics Dashboard Component
 * Displays trusted flagger performance metrics and quality analytics
 * Requirements: 11.1, 11.2, 11.3, 11.5
 */

import React from 'react';
import { ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import {
  formatResponseTime,
  getPerformanceBadgeColor,
} from '@/lib/moderation/trusted-flagger-analytics';
import type { TrustedFlaggerAnalytics } from '@/types/moderation';

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
  const getBadgeColor = (accuracy: number) => {
    const color = getPerformanceBadgeColor(accuracy);
    switch (color) {
      case 'success':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-200';
      case 'warning':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-200';
      case 'danger':
        return 'bg-danger-100 text-danger-800 dark:bg-danger-900/20 dark:text-danger-200';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/20 dark:text-neutral-200';
    }
  };

  const getTrendIcon = (
    trend: 'improving' | 'stable' | 'degrading'
  ): string => {
    switch (trend) {
      case 'improving':
        return '↗';
      case 'stable':
        return '→';
      case 'degrading':
        return '↘';
    }
  };

  const getTrendColor = (
    trend: 'improving' | 'stable' | 'degrading'
  ): string => {
    switch (trend) {
      case 'improving':
        return 'text-success-600 dark:text-success-400';
      case 'stable':
        return 'text-neutral-600 dark:text-neutral-400';
      case 'degrading':
        return 'text-danger-600 dark:text-danger-400';
    }
  };

  const getStatusBadge = (
    status: 'active' | 'warning' | 'suspended'
  ): string => {
    switch (status) {
      case 'active':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-200';
      case 'warning':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-200';
      case 'suspended':
        return 'bg-danger-100 text-danger-800 dark:bg-danger-900/20 dark:text-danger-200';
    }
  };

  return (
    <ScrollView className="flex-1" testID={testID}>
      {/* Summary Cards */}
      <View className="mb-6 flex-row gap-4">
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

        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Avg Accuracy
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {(analytics.aggregate_metrics.average_accuracy * 100).toFixed(1)}%
          </Text>
        </View>

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

        <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            Reports/Month
          </Text>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {analytics.aggregate_metrics.total_reports_this_month}
          </Text>
        </View>
      </View>

      {/* Individual Flagger Cards */}
      <View className="gap-3">
        {analytics.flaggers.map((flagger) => {
          const formatDate = (date: Date | string) => {
            const d = typeof date === 'string' ? new Date(date) : date;
            return d.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          };

          return (
            <View
              key={flagger.flagger_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800"
            >
              {/* Header */}
              <View className="mb-3 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {flagger.flagger_name}
                  </Text>
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    ID: {flagger.flagger_id.slice(0, 8)}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-3 py-1 ${getStatusBadge(flagger.status)}`}
                >
                  <Text className="text-xs font-medium">
                    {flagger.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Metrics Grid */}
              <View className="mb-3 flex-row gap-4">
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Accuracy
                  </Text>
                  <View
                    className={`rounded-md px-2 py-1 ${getBadgeColor(flagger.accuracy_rate)}`}
                  >
                    <Text className="text-center text-sm font-bold">
                      {(flagger.accuracy_rate * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    False Positive
                  </Text>
                  <Text className="text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {(flagger.false_positive_rate * 100).toFixed(1)}%
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Avg Response
                  </Text>
                  <Text className="text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatResponseTime(flagger.average_response_time_ms)}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Trend
                  </Text>
                  <Text
                    className={`text-center text-xl ${getTrendColor(flagger.quality_trend)}`}
                  >
                    {getTrendIcon(flagger.quality_trend)}
                  </Text>
                </View>
              </View>

              {/* Report Volume */}
              <View className="mb-3 flex-row gap-4">
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Total Reports
                  </Text>
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {flagger.report_volume.total}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    This Week
                  </Text>
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {flagger.report_volume.this_week}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    This Month
                  </Text>
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {flagger.report_volume.this_month}
                  </Text>
                </View>
              </View>

              {/* Footer */}
              <View className="flex-row items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-700">
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  Last reviewed: {formatDate(flagger.last_reviewed_at)}
                </Text>
                {onFlaggerPress && (
                  <Text
                    onPress={() => onFlaggerPress(flagger.flagger_id)}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400"
                  >
                    View Details →
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
