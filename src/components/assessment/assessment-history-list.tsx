/**
 * Assessment History List Component
 *
 * Timeline component showing assessment history for a plant.
 * Uses FlashList for performance with large datasets.
 *
 * Requirements:
 * - 3.4: Display assessment history in plant profiles with timeline
 * - 9.1: Enable assessment tracking and progress monitoring
 */

import { FlashList } from '@shopify/flash-list';
import * as React from 'react';

import { Text, View } from '@/components/ui';
import type { AssessmentQueryResult } from '@/lib/assessment/assessment-queries';
import { getAssessmentsByPlantId } from '@/lib/assessment/assessment-queries';

import { AssessmentHistoryCard } from './assessment-history-card';

type AssessmentHistoryListProps = {
  plantId: string;
  limit?: number;
  onAssessmentPress?: (assessmentId: string) => void;
  testID?: string;
};

export function AssessmentHistoryList({
  plantId,
  limit = 50,
  onAssessmentPress,
  testID,
}: AssessmentHistoryListProps) {
  const [assessments, setAssessments] = React.useState<AssessmentQueryResult[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load assessments on mount and when plantId changes
  React.useEffect(() => {
    let mounted = true;

    async function loadAssessments() {
      try {
        setLoading(true);
        setError(null);
        const results = await getAssessmentsByPlantId(plantId, limit);
        if (mounted) {
          setAssessments(results);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load assessments'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAssessments();

    return () => {
      mounted = false;
    };
  }, [plantId, limit]);

  const renderItem = React.useCallback(
    ({ item }: { item: AssessmentQueryResult }) => (
      <View className="mb-3">
        <AssessmentHistoryCard
          assessment={item}
          onPress={onAssessmentPress}
          testID={`${testID}-card-${item.id}`}
        />
      </View>
    ),
    [onAssessmentPress, testID]
  );

  const renderEmpty = React.useCallback(() => {
    if (loading) {
      return (
        <View className="items-center py-8" testID={`${testID}-loading`}>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            Loading assessments...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center py-8" testID={`${testID}-error`}>
          <Text className="text-sm text-danger-600 dark:text-danger-400">
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center py-8" testID={`${testID}-empty`}>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          No assessments yet
        </Text>
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          Use the AI assessment tool to analyze plant health
        </Text>
      </View>
    );
  }, [loading, error, testID]);

  if (loading || error || assessments.length === 0) {
    return renderEmpty();
  }

  return (
    <FlashList
      data={assessments}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      testID={testID}
      contentContainerStyle={{ paddingBottom: 16 }}
    />
  );
}
