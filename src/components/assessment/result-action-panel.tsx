/**
 * Result Action Panel Component
 *
 * Unified action panel for assessment results with primary actions:
 * - Create Tasks from action plan
 * - Ask Community for help
 * - View Assessment History
 * - Retake Photos
 *
 * Requirements:
 * - 3.4: Enable task creation and playbook adjustments
 * - 4.3: Enable community post creation from assessments
 */

import { type Href, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, View } from '@/components/ui';
import type { AssessmentActionPlan } from '@/types/assessment';

type ResultActionPanelProps = {
  plantId: string;
  actionPlan?: AssessmentActionPlan;
  onCreateTasks?: () => void;
  onAskCommunity?: () => void;
  onRetake?: () => void;
  testID?: string;
};

export function ResultActionPanel({
  plantId,
  actionPlan,
  onCreateTasks,
  onAskCommunity,
  onRetake,
  testID = 'result-action-panel',
}: ResultActionPanelProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleViewHistory = React.useCallback(() => {
    // Navigate to plant profile with assessment history
    router.push(`/plants/${plantId}?showAssessments=true` as Href);
  }, [router, plantId]);

  const hasActionPlan =
    actionPlan &&
    (actionPlan.immediateSteps.length > 0 ||
      actionPlan.shortTermActions.length > 0);

  return (
    <View className="mt-6 space-y-3" testID={testID}>
      {/* Primary Actions */}
      {hasActionPlan && onCreateTasks && (
        <Button
          label={t('assessment.result.create_tasks')}
          onPress={onCreateTasks}
          variant="default"
          testID={`${testID}-create-tasks`}
        />
      )}

      {onAskCommunity && (
        <Button
          label={t('assessment.result.ask_community')}
          onPress={onAskCommunity}
          variant="outline"
          testID={`${testID}-ask-community`}
        />
      )}

      {/* Secondary Actions */}
      <View className="flex-row gap-3">
        <Button
          label={t('assessment.result.view_history')}
          onPress={handleViewHistory}
          variant="ghost"
          className="flex-1"
          testID={`${testID}-view-history`}
        />
        {onRetake && (
          <Button
            label={t('assessment.result.retake')}
            onPress={onRetake}
            variant="ghost"
            className="flex-1"
            testID={`${testID}-retake`}
          />
        )}
      </View>
    </View>
  );
}
