/**
 * Task Edit Modal
 *
 * Modal for editing playbook tasks with inheritance tracking
 * Shows edited badge and inheritance status
 */

import type { TFunction } from 'i18next';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TaskModel } from '@/lib/watermelon-models/task';
import type { PlaybookTaskMetadata } from '@/types/playbook';

import { Button, Input, Text, View } from '../ui';

interface TaskEditModalProps {
  task: TaskModel;
  onSave: (updates: {
    title?: string;
    description?: string;
    customNotes?: string;
  }) => Promise<void>;
  onCancel: () => void;
  visible: boolean;
}

function ModalHeader({ isEdited, t }: { isEdited: boolean; t: TFunction }) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Text className="text-xl font-semibold text-charcoal-900 dark:text-neutral-100">
        {t('playbooks.edit_task')}
      </Text>
      {isEdited && (
        <View
          className="rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900"
          testID="edited-badge"
        >
          <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {t('playbooks.edited')}
          </Text>
        </View>
      )}
    </View>
  );
}

function InheritanceWarning({ show, t }: { show: boolean; t: TFunction }) {
  if (!show) return null;
  return (
    <View
      className="mb-4 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20"
      testID="inheritance-warning"
    >
      <Text className="text-sm text-warning-700 dark:text-warning-300">
        {t('playbooks.excluded_from_bulk_shift')}
      </Text>
    </View>
  );
}

export function TaskEditModal({
  task,
  onSave,
  onCancel,
  visible,
}: TaskEditModalProps) {
  const { t } = useTranslation();
  const metadata = task.metadata as PlaybookTaskMetadata | undefined;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [customNotes, setCustomNotes] = useState(metadata?.customNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  const isEdited = metadata?.flags?.manualEdited || false;
  const excluded = metadata?.flags?.excludeFromBulkShift || false;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title: title !== task.title ? title : undefined,
        description: description !== task.description ? description : undefined,
        customNotes:
          customNotes !== metadata?.customNotes ? customNotes : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
      testID="task-edit-modal"
    >
      <View className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-charcoal-900">
        <ModalHeader isEdited={isEdited} t={t} />
        <InheritanceWarning show={excluded} t={t} />

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-charcoal-700 dark:text-neutral-300">
            {t('playbooks.task_title')}
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={t('playbooks.task_title_placeholder')}
            testID="task-title-input"
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-charcoal-700 dark:text-neutral-300">
            {t('playbooks.task_description')}
          </Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={t('playbooks.task_description_placeholder')}
            multiline
            numberOfLines={3}
            testID="task-description-input"
          />
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-charcoal-700 dark:text-neutral-300">
            {t('playbooks.custom_notes')}
          </Text>
          <Input
            value={customNotes}
            onChangeText={setCustomNotes}
            placeholder={t('playbooks.custom_notes_placeholder')}
            multiline
            numberOfLines={3}
            testID="custom-notes-input"
          />
          <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t('playbooks.custom_notes_hint')}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            onPress={onCancel}
            disabled={isSaving}
            className="flex-1"
            testID="cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onPress={handleSave}
            disabled={isSaving}
            loading={isSaving}
            className="flex-1"
            testID="save-button"
          >
            {t('common.save')}
          </Button>
        </View>
      </View>
    </View>
  );
}
