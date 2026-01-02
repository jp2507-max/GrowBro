import { router } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '../ui';

type DiagnosticChecklistProps = {
  plantId: string;
  onCheckToggle?: (checkId: string, checked: boolean) => void;
  testID?: string;
};

type DiagnosticCheckItem = {
  id: string;
  nameKey: string;
  instructionsKey: string;
  estimatedMinutes?: number;
  taskType?: string;
};

const DIAGNOSTIC_CHECKS: DiagnosticCheckItem[] = [
  {
    id: 'ph-check',
    nameKey: 'assessment.diagnostics.phCheck',
    instructionsKey: 'assessment.diagnostics.phInstructions',
    estimatedMinutes: 5,
    taskType: 'ph-measurement',
  },
  {
    id: 'ec-check',
    nameKey: 'assessment.diagnostics.ecCheck',
    instructionsKey: 'assessment.diagnostics.ecInstructions',
    estimatedMinutes: 5,
    taskType: 'ec-measurement',
  },
  {
    id: 'light-check',
    nameKey: 'assessment.diagnostics.lightCheck',
    instructionsKey: 'assessment.diagnostics.lightInstructions',
    estimatedMinutes: 10,
    taskType: 'light-measurement',
  },
  {
    id: 'pest-check',
    nameKey: 'assessment.diagnostics.pestCheck',
    instructionsKey: 'assessment.diagnostics.pestInstructions',
    estimatedMinutes: 5,
  },
  {
    id: 'watering-check',
    nameKey: 'assessment.diagnostics.wateringCheck',
    instructionsKey: 'assessment.diagnostics.wateringInstructions',
    estimatedMinutes: 5,
  },
];

/**
 * Generic diagnostic checklist for uncertain assessments.
 * Provides basic cultivation checks (pH, EC, light, pests, watering).
 */
export function DiagnosticChecklist({
  plantId,
  onCheckToggle,
  testID = 'diagnostic-checklist',
}: DiagnosticChecklistProps) {
  const { t } = useTranslation();
  const [checkedItems, setCheckedItems] = React.useState<Set<string>>(
    new Set()
  );

  const handleCheckToggle = (checkId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      const isChecked = newSet.has(checkId);

      if (isChecked) {
        newSet.delete(checkId);
      } else {
        newSet.add(checkId);
      }

      // Call callback if provided
      if (onCheckToggle) {
        onCheckToggle(checkId, !isChecked);
      }

      return newSet;
    });
  };

  const handleCreateTask = (check: DiagnosticCheckItem) => {
    // Navigate to task creation with prefilled data
    router.push({
      pathname: '/calendar/add-task',
      params: {
        plantId,
        taskType: check.taskType || 'custom',
        title: t(check.nameKey),
        description: t(check.instructionsKey),
      },
    });
  };

  return (
    <View testID={testID}>
      <Text className="mb-3 font-semibold text-charcoal-900 dark:text-neutral-100">
        {t('assessment.diagnostics.title')}
      </Text>
      <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t('assessment.diagnostics.description')}
      </Text>

      <View className="gap-3">
        {DIAGNOSTIC_CHECKS.map((check) => {
          const isChecked = checkedItems.has(check.id);

          return (
            <View
              key={check.id}
              className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-charcoal-700 dark:bg-charcoal-900"
              testID={`${testID}-item-${check.id}`}
            >
              {/* Check header with checkbox */}
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-100">
                    {t(check.nameKey)}
                  </Text>
                  {check.estimatedMinutes && (
                    <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                      {t('assessment.diagnostics.estimatedTime', {
                        minutes: check.estimatedMinutes,
                      })}
                    </Text>
                  )}
                </View>

                {/* Simple checkbox button */}
                <Button
                  label={isChecked ? '✓' : '○'}
                  onPress={() => handleCheckToggle(check.id)}
                  variant="ghost"
                  className="size-8 min-w-0 p-0"
                  testID={`${testID}-checkbox-${check.id}`}
                />
              </View>

              {/* Instructions */}
              <Text className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                {t(check.instructionsKey)}
              </Text>

              {/* Create task button */}
              {check.taskType && (
                <Button
                  label={t('assessment.diagnostics.createTask')}
                  onPress={() => handleCreateTask(check)}
                  variant="outline"
                  size="sm"
                  testID={`${testID}-create-task-${check.id}`}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
