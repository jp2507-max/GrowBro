/**
 * Plant Assessment History Section Component
 *
 * Collapsible section showing assessment history for a plant.
 * Can be integrated into plant profile screens or detail views.
 *
 * Requirements:
 * - 3.4: Display assessment history in plant profiles
 * - 9.1: Enable assessment tracking and progress monitoring
 */

import * as React from 'react';
import { Pressable } from 'react-native';

import { AssessmentHistoryList } from '@/components/assessment';
import { Text, View } from '@/components/ui';
import { getAssessmentCount } from '@/lib/assessment/assessment-queries';
import { translate } from '@/lib/i18n';

type PlantAssessmentHistorySectionProps = {
  plantId: string;
  initiallyExpanded?: boolean;
  testID?: string;
};

export function PlantAssessmentHistorySection({
  plantId,
  initiallyExpanded = false,
  testID = 'plant-assessment-history',
}: PlantAssessmentHistorySectionProps) {
  const [expanded, setExpanded] = React.useState(initiallyExpanded);
  const [count, setCount] = React.useState<number | null>(null);

  // Load assessment count on mount
  React.useEffect(() => {
    let mounted = true;

    async function loadCount() {
      try {
        const total = await getAssessmentCount(plantId);
        if (mounted) {
          setCount(total);
        }
      } catch {
        if (mounted) {
          setCount(0);
        }
      }
    }

    loadCount();

    return () => {
      mounted = false;
    };
  }, [plantId]);

  const toggleExpanded = React.useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View className="mt-4" testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={toggleExpanded}
        className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm active:opacity-70 dark:border-white/10 dark:bg-white/10 dark:shadow-none"
        testID={`${testID}-header`}
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-charcoal-900 dark:text-neutral-100">
            {translate('plants.assessment_history.title')}
          </Text>
          {count !== null && (
            <Text className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {count === 0
                ? translate('plants.assessment_history.count_zero')
                : count === 1
                  ? translate('plants.assessment_history.count_one', {
                      count,
                    })
                  : translate('plants.assessment_history.count_other', {
                      count,
                    })}
            </Text>
          )}
        </View>
        <Text className="text-xl text-neutral-600 dark:text-neutral-400">
          {expanded ? '▼' : '▶'}
        </Text>
      </Pressable>

      {expanded && (
        <View className="mt-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/10 dark:shadow-none">
          {count === 0 ? (
            <View className="items-center py-6">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                {translate('plants.assessment_history.count_zero')}
              </Text>
              <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {translate('plants.assessment_history.empty_description')}
              </Text>
            </View>
          ) : (
            <View className="h-[300px]">
              <AssessmentHistoryList
                plantId={plantId}
                testID={`${testID}-list`}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
