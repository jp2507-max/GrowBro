/**
 * Task Creation Modal Component
 *
 * Modal for confirming and executing task creation from assessment action plans.
 * Shows task count, handles batch creation, and displays success/failure feedback.
 *
 * Requirements:
 * - 3.4: Enable task creation from assessment results with prefilled details
 * - 9.1: Track task creation rates for analytics
 */

import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import { Button, Text, View } from '@/components/ui';
import {
  getTaskCreationMessage,
  handleTaskCreation,
  type TaskCreationHandlerOptions,
  type TaskCreationHandlerResult,
} from '@/lib/assessment/task-creation-handler';
import { countCreatableTasks } from '@/lib/assessment/task-integration';
import type {
  AssessmentActionPlan,
  AssessmentResult,
} from '@/types/assessment';

type TaskCreationModalProps = {
  visible: boolean;
  onClose: () => void;
  assessment: AssessmentResult;
  assessmentId: string;
  plantId: string;
  actionPlan: AssessmentActionPlan;
  timezone?: string;
  testID?: string;
};

export function TaskCreationModal({
  visible,
  onClose,
  assessment,
  assessmentId,
  plantId,
  actionPlan,
  timezone,
  testID = 'task-creation-modal',
}: TaskCreationModalProps) {
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const [creating, setCreating] = React.useState(false);

  const taskCount = React.useMemo(
    () => countCreatableTasks(actionPlan),
    [actionPlan]
  );

  // Sync visibility with bottom sheet
  React.useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleCreateTasks = React.useCallback(async () => {
    if (creating) return;

    setCreating(true);

    try {
      const options: TaskCreationHandlerOptions = {
        plan: actionPlan,
        plantId,
        assessmentId,
        classId: assessment.topClass.id,
        timezone,
        assessment,
      };

      const result: TaskCreationHandlerResult =
        await handleTaskCreation(options);

      // Show success/failure message
      const message = getTaskCreationMessage(result);
      showMessage({
        message: result.success ? 'Tasks Created' : 'Task Creation Failed',
        description: message,
        type: result.success ? 'success' : 'danger',
        duration: 3000,
      });

      // Close modal on success
      if (result.success) {
        onClose();
      }
    } catch (error) {
      showMessage({
        message: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create tasks. Please try again.',
        type: 'danger',
        duration: 3000,
      });
    } finally {
      setCreating(false);
    }
  }, [
    creating,
    actionPlan,
    plantId,
    assessmentId,
    assessment,
    timezone,
    onClose,
  ]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['50%']}
      onDismiss={onClose}
      enablePanDownToClose
      enableDismissOnClose
    >
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 16 }}
        testID={testID}
      >
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Create Tasks
        </Text>

        <Text className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {taskCount === 0
            ? 'No tasks to create from this action plan.'
            : `Create ${taskCount} task${taskCount === 1 ? '' : 's'} from this assessment?`}
        </Text>

        {taskCount > 0 && (
          <View className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Tasks to create:
            </Text>
            <View className="mt-2 space-y-1">
              {actionPlan.immediateSteps
                .filter((step) => step.taskTemplate)
                .map((step, index) => (
                  <Text
                    key={`immediate-${index}`}
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    • {step.taskTemplate?.name ?? step.title}
                  </Text>
                ))}
              {actionPlan.shortTermActions
                .filter((step) => step.taskTemplate)
                .map((step, index) => (
                  <Text
                    key={`shortterm-${index}`}
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    • {step.taskTemplate?.name ?? step.title}
                  </Text>
                ))}
            </View>
          </View>
        )}

        <View className="mt-6 flex-row gap-3">
          <Button
            label="Cancel"
            onPress={onClose}
            variant="outline"
            className="flex-1"
            disabled={creating}
            testID={`${testID}-cancel`}
          />
          <Button
            label={creating ? 'Creating...' : 'Create Tasks'}
            onPress={handleCreateTasks}
            className="flex-1"
            disabled={creating || taskCount === 0}
            testID={`${testID}-confirm`}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
