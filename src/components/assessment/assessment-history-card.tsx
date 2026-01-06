/**
 * Assessment History Card Component
 *
 * Displays individual assessment record in plant profile timeline.
 * Shows class, confidence, timestamp, and resolution status.
 *
 * Requirements:
 * - 3.4: Display assessment history in plant profiles
 * - 9.1: Show assessment tracking data
 */

import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import type { AssessmentQueryResult } from '@/lib/assessment/assessment-queries';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';

type AssessmentHistoryCardProps = {
  assessment: AssessmentQueryResult;
  onPress?: (assessmentId: string) => void;
  testID?: string;
};

export function AssessmentHistoryCard({
  assessment,
  onPress,
  testID,
}: AssessmentHistoryCardProps) {
  const router = useRouter();

  const handlePress = React.useCallback(() => {
    if (onPress) {
      onPress(assessment.id);
    } else {
      // Default: navigate to result screen
      router.push({
        pathname: '/assessment/result',
        params: { assessmentId: assessment.id },
      });
    }
  }, [assessment.id, onPress, router]);

  const confidencePercent = assessment.calibratedConfidence
    ? Math.round(assessment.calibratedConfidence * 100)
    : null;

  const relativeTime = React.useMemo(() => {
    return formatRelativeTimeTranslated(assessment.createdAt.toISOString());
  }, [assessment.createdAt]);

  const statusColor = React.useMemo(() => {
    if (assessment.status === 'completed') {
      return assessment.issueResolved
        ? 'text-success-600 dark:text-success-400'
        : 'text-warning-600 dark:text-warning-400';
    }
    if (assessment.status === 'failed') {
      return 'text-danger-600 dark:text-danger-400';
    }
    return 'text-neutral-600 dark:text-neutral-400';
  }, [assessment.status, assessment.issueResolved]);

  const statusLabel = React.useMemo(() => {
    if (assessment.status === 'completed') {
      return assessment.issueResolved ? 'Resolved' : 'Pending';
    }
    if (assessment.status === 'failed') {
      return 'Failed';
    }
    if (assessment.status === 'processing') {
      return 'Processing';
    }
    return 'Pending';
  }, [assessment.status, assessment.issueResolved]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      testID={testID}
      className="active:opacity-70"
    >
      <View className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-charcoal-700 dark:bg-charcoal-900">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-charcoal-900 dark:text-neutral-100">
              {assessment.predictedClass
                ? formatClassName(assessment.predictedClass)
                : 'Assessment in progress'}
            </Text>
            {confidencePercent !== null && (
              <Text className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                {confidencePercent}% confidence
              </Text>
            )}
          </View>
          <View className="ml-2">
            <Text className={`text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {relativeTime}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {assessment.inferenceMode === 'device' ? '📱 Device' : '☁️ Cloud'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Format class name for display (convert snake_case to Title Case)
 */
function formatClassName(className: string): string {
  return className
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
