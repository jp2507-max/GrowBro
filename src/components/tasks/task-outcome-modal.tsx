import React, { useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Modal, Text, useModal, View } from '@/components/ui';
import type { Task } from '@/types/calendar';

type TaskOutcomeModalProps = {
  task: Task | null;
  onStillDry: (task: Task) => void;
  onDismiss?: () => void;
};

export type TaskOutcomeModalRef = {
  present: () => void;
  dismiss: () => void;
};

export const TaskOutcomeModal = React.forwardRef<
  TaskOutcomeModalRef,
  TaskOutcomeModalProps
>(({ task, onStillDry, onDismiss }, ref) => {
  const { t } = useTranslation();
  const modal = useModal();

  useImperativeHandle(ref, () => ({
    present: modal.present,
    dismiss: modal.dismiss,
  }));

  const handleDismiss = React.useCallback(() => {
    modal.dismiss();
    onDismiss?.();
  }, [modal, onDismiss]);

  const handleStillDry = React.useCallback(() => {
    if (task) onStillDry(task);
    handleDismiss();
  }, [handleDismiss, onStillDry, task]);

  return (
    <Modal
      ref={modal.ref}
      title={t('tasks.outcome.title')}
      snapPoints={['40%']}
      testID="task-outcome-modal"
    >
      <View className="p-6">
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {t('tasks.outcome.subtitle')}
        </Text>

        <View className="mt-6 flex-row gap-3">
          <Button
            label={t('tasks.outcome.all_good')}
            variant="outline"
            onPress={handleDismiss}
            className="flex-1"
          />
          <Button
            label={t('tasks.outcome.still_dry')}
            onPress={handleStillDry}
            className="flex-1"
          />
        </View>
      </View>
    </Modal>
  );
});
