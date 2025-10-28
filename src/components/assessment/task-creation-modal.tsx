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
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
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
  const { t } = useTranslation();
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const [creating, setCreating] = React.useState(false);

  const taskCount = React.useMemo(
    () => countCreatableTasks(actionPlan),
    [actionPlan]
  );

  const taskLabels = React.useMemo(() => {
    const immediateTasks = actionPlan.immediateSteps
      .filter((step) => step.taskTemplate)
      .map((step) => ({
        id: `immediate-${step.title}|${step.description}`,
        label: step.taskTemplate?.name ?? step.title,
      }));
    const shortTermTasks = actionPlan.shortTermActions
      .filter((step) => step.taskTemplate)
      .map((step) => ({
        id: `shortterm-${step.title}|${step.description}`,
        label: step.taskTemplate?.name ?? step.title,
      }));
    return [...immediateTasks, ...shortTermTasks];
  }, [actionPlan]);

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
        message: result.success
          ? t('tasks.created')
          : t('tasks.creationFailed'),
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
        message: t('common.error'),
        description:
          error instanceof Error
            ? error.message
            : t('assessment.taskCreation.failed'),
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
    t,
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
        contentContainerStyle={styles.contentContainer}
        testID={testID}
      >
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('assessment.taskCreation.title')}
        </Text>

        <Text className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {taskCount === 0
            ? t('assessment.taskCreation.noTasks')
            : t('assessment.taskCreation.createTasks', { count: taskCount })}
        </Text>

        {taskCount > 0 && (
          <TaskSummaryCard
            title={t('assessment.taskCreation.tasksToCreate')}
            tasks={taskLabels}
          />
        )}

        <TaskCreationFooter
          creating={creating}
          hasTasks={taskCount > 0}
          onCancel={onClose}
          onConfirm={handleCreateTasks}
          testID={testID}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('assessment.taskCreation.createTasksButton')}
          creatingLabel={t('assessment.taskCreation.creating')}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

type TaskSummaryCardProps = {
  title: string;
  tasks: { id: string; label: string }[];
};

function TaskSummaryCard({ title, tasks }: TaskSummaryCardProps) {
  return (
    <View className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {title}
      </Text>
      <View className="mt-2 space-y-1">
        {tasks.map((task) => (
          <Text
            key={task.id}
            className="text-sm text-neutral-700 dark:text-neutral-300"
          >
            • {task.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type TaskCreationFooterProps = {
  creating: boolean;
  hasTasks: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  testID: string;
  cancelLabel: string;
  confirmLabel: string;
  creatingLabel: string;
};

function TaskCreationFooter({
  creating,
  hasTasks,
  onCancel,
  onConfirm,
  testID,
  cancelLabel,
  confirmLabel,
  creatingLabel,
}: TaskCreationFooterProps) {
  return (
    <View className="mt-6 flex-row gap-3">
      <Button
        label={cancelLabel}
        onPress={onCancel}
        variant="outline"
        className="flex-1"
        disabled={creating}
        testID={`${testID}-cancel`}
      />
      <Button
        label={creating ? creatingLabel : confirmLabel}
        onPress={onConfirm}
        className="flex-1"
        disabled={creating || !hasTasks}
        testID={`${testID}-confirm`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
  },
});
