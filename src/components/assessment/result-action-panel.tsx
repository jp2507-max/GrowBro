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

import { useRouter } from 'expo-router';
import * as React from 'react';

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

  const handleViewHistory = React.useCallback(() => {
    // Navigate to plant profile with assessment history
    router.push({
      pathname: '/plants',
      params: { plantId, showAssessments: 'true' },
    });
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
          label="Create Tasks"
          onPress={onCreateTasks}
          variant="default"
          testID={`${testID}-create-tasks`}
        />
      )}

      {onAskCommunity && (
        <Button
          label="Ask Community"
          onPress={onAskCommunity}
          variant="outline"
          testID={`${testID}-ask-community`}
        />
      )}

      {/* Secondary Actions */}
      <View className="flex-row gap-3">
        <Button
          label="View History"
          onPress={handleViewHistory}
          variant="ghost"
          className="flex-1"
          testID={`${testID}-view-history`}
        />
        {onRetake && (
          <Button
            label="Retake"
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
