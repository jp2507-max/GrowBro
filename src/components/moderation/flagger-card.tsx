import i18n from 'i18next';
import React from 'react';

import { Text, View } from '@/components/ui';
import {
  formatResponseTime,
  getPerformanceBadgeColor,
} from '@/lib/moderation/trusted-flagger-analytics';
import type { TrustedFlaggerMetrics } from '@/types/moderation';

type Props = {
  flagger: TrustedFlaggerMetrics;
  onFlaggerPress?: (flaggerId: string) => void;
};

// Helper: choose a Tailwind badge class based on a numeric accuracy value.
function getBadgeColor(accuracy: number): string {
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
}

// Helper: compact textual icon representing trend direction.
function getTrendIcon(trend: 'improving' | 'stable' | 'degrading'): string {
  switch (trend) {
    case 'improving':
      return '↗';
    case 'stable':
      return '→';
    case 'degrading':
      return '↘';
  }
}

// Helper: map trend -> text color classes.
function getTrendColor(trend: 'improving' | 'stable' | 'degrading'): string {
  switch (trend) {
    case 'improving':
      return 'text-success-600 dark:text-success-400';
    case 'stable':
      return 'text-neutral-600 dark:text-neutral-400';
    case 'degrading':
      return 'text-danger-600 dark:text-danger-400';
  }
}

// Helper: status -> badge classes.
function getStatusBadge(status: 'active' | 'warning' | 'suspended'): string {
  switch (status) {
    case 'active':
      return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-200';
    case 'warning':
      return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-200';
    case 'suspended':
      return 'bg-danger-100 text-danger-800 dark:bg-danger-900/20 dark:text-danger-200';
  }
}

// Helper to format the last reviewed date.
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Map i18n language codes to locale strings
  const localeMap: Record<string, string> = {
    en: 'en-US',
    de: 'de-DE',
  };

  const currentLanguage = i18n.language || 'en';
  const locale = localeMap[currentLanguage] || 'en-US';

  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Sub-component: Header section with flagger name, ID, and status badge
function FlaggerCardHeader({ flagger }: { flagger: TrustedFlaggerMetrics }) {
  return (
    <View className="mb-3 flex-row items-start justify-between">
      <View className="flex-1">
        <Text className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {flagger.flagger_name}
        </Text>
        <Text
          className="text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.idLabel"
          txOptions={{ id: flagger.flagger_id.slice(0, 8) }}
        />
      </View>
      <View
        className={`rounded-full px-3 py-1 ${getStatusBadge(flagger.status)}`}
      >
        <Text
          className="text-xs font-medium"
          tx={`moderation.flagger.status.${flagger.status}`}
        />
      </View>
    </View>
  );
}

// Sub-component: Metrics grid with accuracy, false positive, response time, and trend
function FlaggerCardMetrics({ flagger }: { flagger: TrustedFlaggerMetrics }) {
  return (
    <View className="mb-3 flex-row gap-4">
      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.accuracy"
        />
        <View
          className={`rounded-md px-2 py-1 ${getBadgeColor(flagger.accuracy_rate)}`}
        >
          <Text className="text-center text-sm font-bold">
            {(flagger.accuracy_rate * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.falsePositive"
        />
        <Text className="text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {(flagger.false_positive_rate * 100).toFixed(1)}%
        </Text>
      </View>

      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.avgResponse"
        />
        <Text className="text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {formatResponseTime(flagger.average_response_time_ms)}
        </Text>
      </View>

      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.trend"
        />
        <Text
          className={`text-center text-xl ${getTrendColor(flagger.quality_trend)}`}
        >
          {getTrendIcon(flagger.quality_trend)}
        </Text>
      </View>
    </View>
  );
}

// Sub-component: Report volume section with total, weekly, and monthly counts
function FlaggerCardReportVolume({
  flagger,
}: {
  flagger: TrustedFlaggerMetrics;
}) {
  return (
    <View className="mb-3 flex-row gap-4">
      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.totalReports"
        />
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {flagger.report_volume.total}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.thisWeek"
        />
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {flagger.report_volume.this_week}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
          tx="moderation.flagger.thisMonth"
        />
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {flagger.report_volume.this_month}
        </Text>
      </View>
    </View>
  );
}

// Sub-component: Footer with last reviewed date and optional view details CTA
function FlaggerCardFooter({
  flagger,
  onFlaggerPress,
}: {
  flagger: TrustedFlaggerMetrics;
  onFlaggerPress?: (flaggerId: string) => void;
}) {
  return (
    <View className="flex-row items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <Text
        className="text-xs text-neutral-600 dark:text-neutral-400"
        tx="moderation.flagger.lastReviewed"
        txOptions={{ date: formatDate(flagger.last_reviewed_at) }}
      />
      {onFlaggerPress && (
        <Text
          onPress={() => onFlaggerPress(flagger.flagger_id)}
          className="text-xs font-medium text-primary-600 dark:text-primary-400"
          tx="moderation.flagger.viewDetails"
        />
      )}
    </View>
  );
}

export function FlaggerCard({ flagger, onFlaggerPress }: Props) {
  return (
    <View
      key={flagger.flagger_id}
      className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800"
    >
      <FlaggerCardHeader flagger={flagger} />
      <FlaggerCardMetrics flagger={flagger} />
      <FlaggerCardReportVolume flagger={flagger} />
      <FlaggerCardFooter flagger={flagger} onFlaggerPress={onFlaggerPress} />
    </View>
  );
}
