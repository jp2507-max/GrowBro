/**
 * Feeding Adjustment Modal
 *
 * Confirmation modal for feeding schedule adjustments based on pH/EC deviations.
 * Shows preview of proposed changes with adjustment details and user confirmation.
 *
 * Requirements: 5.5, 5.6
 */

import { DateTime } from 'luxon';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { Modal, useModal } from '@/components/ui/modal';
import type {
  AdjustmentProposal,
  ProposedAdjustment,
} from '@/lib/nutrient-engine/services/schedule-adjustment-service';

export type FeedingAdjustmentModalProps = {
  proposal: AdjustmentProposal;
  onConfirm: (adjustments: ProposedAdjustment[]) => Promise<void>;
  onCancel: () => void;
  timezone: string;
};

type FeedingAdjustmentModalInnerProps = {
  modal: ReturnType<typeof useModal>;
  proposal: AdjustmentProposal;
  timezone: string;
  selectedTasks: Set<string>;
  toggleTask: (taskId: string) => void;
  handleCancel: () => void;
  handleConfirmAll: () => Promise<void>;
  handleConfirmSelected: () => Promise<void>;
  isLoading: boolean;
};

export type FeedingAdjustmentModalHandle = {
  present: () => void;
  dismiss: () => void;
};

/**
 * Modal header with alert summary
 */
function ModalHeader({
  alertMessage,
  taskCount,
  onClose,
}: {
  alertMessage: string;
  taskCount: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-charcoal-950 dark:text-neutral-100">
          {t('nutrient.adjustmentRequired')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nutrient.closeModal')}
          accessibilityHint={t('nutrient.closeModalHint')}
          onPress={onClose}
          className="rounded-full p-2"
          testID="close-button"
        >
          <Text className="text-lg text-neutral-500 dark:text-neutral-400">
            ✕
          </Text>
        </Pressable>
      </View>

      <View className="rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-800 dark:bg-warning-900/20">
        <Text className="text-sm font-semibold text-warning-800 dark:text-warning-200">
          {alertMessage}
        </Text>
        <Text className="mt-1 text-xs text-warning-700 dark:text-warning-300">
          {taskCount === 1
            ? t('nutrient.tasksAffected_one', { count: taskCount })
            : t('nutrient.tasksAffected_other', { count: taskCount })}
        </Text>
      </View>
    </View>
  );
}

/**
 * Alert recommendations section
 */
function RecommendationsSection({
  recommendations,
}: {
  recommendations: string[];
}) {
  const { t } = useTranslation();
  return (
    <View className="mb-4 rounded-lg bg-primary-50 p-4 dark:bg-primary-900/10">
      <Text className="mb-2 font-semibold text-primary-900 dark:text-primary-100">
        {t('nutrient.recommendedActions')}
      </Text>
      {recommendations.map((rec, index) => (
        <View key={index} className="mb-1 flex-row">
          <Text className="mr-2 text-primary-700 dark:text-primary-300">•</Text>
          <Text className="flex-1 text-sm text-primary-800 dark:text-primary-200">
            {rec}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Format date for display
 */
function formatTaskDate(dateIso: string, timezone: string): string {
  const dt = DateTime.fromISO(dateIso, { zone: timezone });
  return dt.toFormat('MMM d, h:mm a');
}

/**
 * Task adjustment preview row
 */
function TaskAdjustmentRow({
  adjustment,
  timezone,
  selected,
  onToggle,
}: {
  adjustment: ProposedAdjustment;
  timezone: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const severityColors = {
    low: 'bg-primary-100 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800',
    medium:
      'bg-warning-100 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800',
    high: 'bg-danger-100 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800',
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${adjustment.taskTitle}, ${adjustment.reason}`}
      accessibilityHint={t('nutrient.toggleTaskHint', {
        status: selected ? t('common.selected') : t('common.not_selected'),
      })}
      onPress={onToggle}
      className={`mb-3 rounded-lg border p-3 ${severityColors[adjustment.severity]} ${
        selected ? 'opacity-100' : 'opacity-60'
      }`}
      testID={`task-adjustment-${adjustment.taskId}`}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-semibold text-charcoal-950 dark:text-neutral-100">
            {adjustment.taskTitle}
          </Text>
          <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {formatTaskDate(adjustment.currentDueDate, timezone)}
          </Text>
        </View>
        <View
          className={`size-5 items-center justify-center rounded border-2 ${
            selected
              ? 'border-primary-600 bg-primary-600'
              : 'border-neutral-300 dark:border-neutral-600'
          }`}
        >
          {selected && <Text className="text-xs font-bold text-white">✓</Text>}
        </View>
      </View>

      <View className="mb-2 rounded-md bg-white/50 p-2 dark:bg-charcoal-900/50">
        <Text className="text-xs font-semibold text-charcoal-800 dark:text-neutral-300">
          {t('nutrient.actionLabel')}{' '}
          {adjustment.action.replace(/_/g, ' ').toUpperCase()}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700 dark:text-neutral-400">
          {adjustment.reason}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Task list section with selection
 */
function TaskListSection({
  adjustments,
  timezone,
  selectedTasks,
  onToggle,
}: {
  adjustments: ProposedAdjustment[];
  timezone: string;
  selectedTasks: Set<string>;
  onToggle: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('nutrient.proposedAdjustments')}
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('nutrient.selectionCount', {
            selected: selectedTasks.size,
            total: adjustments.length,
          })}
        </Text>
      </View>

      {adjustments.map((adjustment) => (
        <TaskAdjustmentRow
          key={adjustment.taskId}
          adjustment={adjustment}
          timezone={timezone}
          selected={selectedTasks.has(adjustment.taskId)}
          onToggle={() => onToggle(adjustment.taskId)}
        />
      ))}
    </View>
  );
}

/**
 * Info notice about undo capability
 */
function UndoNotice() {
  const { t } = useTranslation();
  return (
    <View className="mb-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/10">
      <Text className="text-xs text-primary-700 dark:text-primary-300">
        {t('nutrient.undoNotice')}
      </Text>
    </View>
  );
}

/**
 * Action buttons with confirmation
 */
function ActionButtons({
  onConfirmAll,
  onConfirmSelected,
  onCancel,
  selectedCount,
  totalCount,
  isLoading,
}: {
  onConfirmAll: () => void;
  onConfirmSelected: () => void;
  onCancel: () => void;
  selectedCount: number;
  totalCount: number;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;
  const allSelected = selectedCount === totalCount;

  return (
    <View className="gap-3">
      <Button
        label={
          allSelected
            ? t('nutrient.applyAll', { count: totalCount })
            : t('nutrient.applySelected', { count: selectedCount })
        }
        onPress={allSelected ? onConfirmAll : onConfirmSelected}
        disabled={!hasSelection || isLoading}
        loading={isLoading}
        testID="confirm-adjustments-button"
      />
      <Button
        label={t('common.cancel')}
        variant="outline"
        onPress={onCancel}
        disabled={isLoading}
        testID="cancel-adjustments-button"
      />
    </View>
  );
}

/**
 * Hook for managing task selection state
 */
function useTaskSelection(proposal: AdjustmentProposal) {
  const [selectedTasks, setSelectedTasks] = React.useState<Set<string>>(
    () => new Set(proposal.proposedAdjustments.map((a) => a.taskId))
  );

  const toggleTask = React.useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const reset = React.useCallback(() => {
    setSelectedTasks(
      new Set(proposal.proposedAdjustments.map((a) => a.taskId))
    );
  }, [proposal.proposedAdjustments]);

  return { selectedTasks, toggleTask, reset };
}

/**
 * Modal content component
 */
function ModalContent({
  proposal,
  timezone,
  selectedTasks,
  toggleTask,
  handleCancel,
  handleConfirmAll,
  handleConfirmSelected,
  isLoading,
}: {
  proposal: AdjustmentProposal;
  timezone: string;
  selectedTasks: Set<string>;
  toggleTask: (taskId: string) => void;
  handleCancel: () => void;
  handleConfirmAll: () => void;
  handleConfirmSelected: () => void;
  isLoading: boolean;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-charcoal-950">
      <ScrollView className="flex-1 px-4">
        <ModalHeader
          alertMessage={proposal.alert.message}
          taskCount={proposal.affectedTaskCount}
          onClose={handleCancel}
        />

        <RecommendationsSection
          recommendations={proposal.alert.recommendations}
        />

        <TaskListSection
          adjustments={proposal.proposedAdjustments}
          timezone={timezone}
          selectedTasks={selectedTasks}
          onToggle={toggleTask}
        />

        <UndoNotice />
      </ScrollView>

      <View className="border-t border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-800 dark:bg-charcoal-900">
        <ActionButtons
          onConfirmAll={handleConfirmAll}
          onConfirmSelected={handleConfirmSelected}
          onCancel={handleCancel}
          selectedCount={selectedTasks.size}
          totalCount={proposal.affectedTaskCount}
          isLoading={isLoading}
        />
      </View>
    </View>
  );
}

/**
 * Custom hook for feeding adjustment modal logic
 */
function useFeedingAdjustmentModal(
  proposal: AdjustmentProposal,
  onConfirm: (adjustments: ProposedAdjustment[]) => Promise<void>,
  onCancel: () => void
) {
  const modal = useModal();
  const [isLoading, setIsLoading] = React.useState(false);
  const { selectedTasks, toggleTask, reset } = useTaskSelection(proposal);

  const handleConfirmAll = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm(proposal.proposedAdjustments);
      modal.dismiss();
    } catch (error) {
      console.error('Failed to apply adjustments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, proposal.proposedAdjustments, modal]);

  const handleConfirmSelected = React.useCallback(async () => {
    if (selectedTasks.size === 0) return;

    const selectedAdjustments = proposal.proposedAdjustments.filter((adj) =>
      selectedTasks.has(adj.taskId)
    );

    setIsLoading(true);
    try {
      await onConfirm(selectedAdjustments);
      modal.dismiss();
    } catch (error) {
      console.error('Failed to apply selected adjustments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTasks, onConfirm, proposal.proposedAdjustments, modal]);

  const handleCancel = React.useCallback(() => {
    reset();
    onCancel();
    modal.dismiss();
  }, [reset, onCancel, modal]);

  // Reset selection when proposal changes
  React.useEffect(() => {
    reset();
  }, [proposal, reset]);

  return {
    modal,
    isLoading,
    selectedTasks,
    toggleTask,
    handleCancel,
    handleConfirmAll,
    handleConfirmSelected,
  };
}

/**
 * Feeding Adjustment Modal Component
 *
 * Bottom sheet modal for confirming feeding schedule adjustments.
 * Shows deviation alert, recommendations, and affected tasks with preview.
 *
 * @example
 * ```tsx
 * const modalRef = React.useRef<FeedingAdjustmentModalHandle>(null);
 *
 * const handleProposal = (proposal: AdjustmentProposal) => {
 *   modalRef.current?.present();
 * };
 *
 * <FeedingAdjustmentModal
 *   ref={modalRef}
 *   proposal={proposal}
 *   onConfirm={applyAdjustments}
 *   onCancel={() => modalRef.current?.dismiss()}
 *   timezone="America/New_York"
 * />
 * ```
 */
function FeedingAdjustmentModalInner({
  modal,
  proposal,
  timezone,
  selectedTasks,
  toggleTask,
  handleCancel,
  handleConfirmAll,
  handleConfirmSelected,
  isLoading,
}: FeedingAdjustmentModalInnerProps) {
  const { t } = useTranslation();

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['90%']}
      title={t('nutrient.scheduleAdjustmentTitle')}
      testID="feeding-adjustment-modal"
    >
      <ModalContent
        proposal={proposal}
        timezone={timezone}
        selectedTasks={selectedTasks}
        toggleTask={toggleTask}
        handleCancel={handleCancel}
        handleConfirmAll={handleConfirmAll}
        handleConfirmSelected={handleConfirmSelected}
        isLoading={isLoading}
      />
    </Modal>
  );
}

export const FeedingAdjustmentModal = React.forwardRef<
  FeedingAdjustmentModalHandle,
  FeedingAdjustmentModalProps
>(({ proposal, onConfirm, onCancel, timezone }, ref) => {
  const {
    modal,
    isLoading,
    selectedTasks,
    toggleTask,
    handleCancel,
    handleConfirmAll,
    handleConfirmSelected,
  } = useFeedingAdjustmentModal(proposal, onConfirm, onCancel);

  React.useImperativeHandle(ref, () => ({
    present: modal.present,
    dismiss: modal.dismiss,
  }));

  return (
    <FeedingAdjustmentModalInner
      modal={modal}
      proposal={proposal}
      timezone={timezone}
      selectedTasks={selectedTasks}
      toggleTask={toggleTask}
      handleCancel={handleCancel}
      handleConfirmAll={handleConfirmAll}
      handleConfirmSelected={handleConfirmSelected}
      isLoading={isLoading}
    />
  );
});

FeedingAdjustmentModal.displayName = 'FeedingAdjustmentModal';
