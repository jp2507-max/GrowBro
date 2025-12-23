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
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

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
  const { t } = useTranslation();
  const listTestID = testID ?? 'assessment-history-list';
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
            err instanceof Error ? err.message : t('assessment.history.error')
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
  }, [plantId, limit, t]);

  const renderItem = React.useCallback(
    ({ item }: { item: AssessmentQueryResult }) => (
      <View className="mb-3">
        <AssessmentHistoryCard
          assessment={item}
          onPress={onAssessmentPress}
          testID={`${listTestID}-card-${item.id}`}
        />
      </View>
    ),
    [listTestID, onAssessmentPress]
  );

  const renderEmpty = React.useCallback(() => {
    if (loading) {
      return (
        <View className="items-center py-8" testID={`${listTestID}-loading`}>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('assessment.history.loading')}
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center py-8" testID={`${listTestID}-error`}>
          <Text className="text-sm text-danger-600 dark:text-danger-400">
            {error || t('assessment.history.error')}
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center py-8" testID={`${listTestID}-empty`}>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('assessment.history.empty')}
        </Text>
        <Text className="text-text-secondary mt-1 text-xs">
          {t('assessment.history.emptyHint')}
        </Text>
      </View>
    );
  }, [loading, error, listTestID, t]);

  if (loading || error || assessments.length === 0) {
    return renderEmpty();
  }

  return (
    <FlashList
      data={assessments}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      testID={listTestID}
      contentContainerStyle={styles.contentContainer}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 16,
  },
});
