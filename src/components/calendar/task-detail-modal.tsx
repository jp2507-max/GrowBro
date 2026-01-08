import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

import { Modal, Text, useModal, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowRight, Check, Trash } from '@/components/ui/icons';
import { BottomSheetView } from '@/components/ui/modal';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

type TaskDetailModalProps = {
  modalRef: React.RefObject<BottomSheetModal | null>;
  task: Task | null;
  onComplete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onDismiss?: () => void;
};

function formatTime(dueAtLocal: string, timezone?: string): string {
  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';
  const dt = DateTime.fromISO(dueAtLocal, { zone });

  if (!dt.isValid) {
    return '—';
  }

  return dt.toFormat('HH:mm');
}

function CategoryBadge({
  category,
}: {
  category?: string;
}): React.ReactElement | null {
  if (!category) return null;

  return (
    <View className="self-start rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900/30">
      <Text className="text-sm font-semibold text-primary-700 dark:text-primary-300">
        {category}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  variant = 'default',
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'success' | 'danger';
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  const variantStyles = {
    default: 'bg-neutral-100 dark:bg-charcoal-800',
    success: 'bg-success-100 dark:bg-success-900/30',
    danger: 'bg-danger-100 dark:bg-danger-900/30',
  };

  const textStyles = {
    default: 'text-neutral-700 dark:text-neutral-200',
    success: 'text-success-700 dark:text-success-300',
    danger: 'text-danger-700 dark:text-danger-300',
  };

  return (
    <Pressable
      onPress={handlePress}
      className={twMerge(
        'flex-1 items-center gap-1.5 rounded-2xl py-3',
        variantStyles[variant]
      )}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`Performs ${label} action`}
      testID={testID}
    >
      {icon}
      <Text className={twMerge('text-sm font-semibold', textStyles[variant])}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Hook for dark mode aware modal styling
 */
function useModalDarkModeStyles() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const backgroundStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? colors.darkSurface.card : colors.white,
      borderTopLeftRadius: 35,
      borderTopRightRadius: 35,
    }),
    [isDark]
  );

  const handleStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D4D4D4',
      width: 48,
      height: 6,
      borderRadius: 3,
    }),
    [isDark]
  );

  return { backgroundStyle, handleStyle };
}

export function TaskDetailModal({
  modalRef,
  task,
  onComplete,
  onEdit,
  onDelete,
  onDismiss,
}: TaskDetailModalProps): React.ReactElement {
  const { backgroundStyle, handleStyle } = useModalDarkModeStyles();
  const dismiss = React.useCallback(() => {
    modalRef.current?.dismiss();
    onDismiss?.();
  }, [modalRef, onDismiss]);

  const handleComplete = React.useCallback(() => {
    if (task && onComplete) {
      haptics.success();
      onComplete(task);
      dismiss();
    }
  }, [task, onComplete, dismiss]);

  const handleEdit = React.useCallback(() => {
    if (task && onEdit) {
      onEdit(task);
      dismiss();
    }
  }, [task, onEdit, dismiss]);

  const handleDelete = React.useCallback(() => {
    if (task && onDelete) {
      haptics.warning();
      onDelete(task);
      dismiss();
    }
  }, [task, onDelete, dismiss]);

  const title = translate('calendar.task_detail.title');

  if (!task) {
    return (
      <Modal
        ref={modalRef}
        snapPoints={['40%']}
        testID="task-detail-modal"
        backgroundStyle={backgroundStyle}
        handleIndicatorStyle={handleStyle}
      >
        <BottomSheetView style={styles.content}>
          <Text className="text-center text-neutral-500">
            {translate('calendar.noTaskSelected')}
          </Text>
        </BottomSheetView>
      </Modal>
    );
  }

  const time = formatTime(task.dueAtLocal, task.timezone);
  const noDescription = translate('calendar.task_detail.no_description');

  return (
    <Modal
      ref={modalRef}
      snapPoints={['50%']}
      title={title}
      testID="task-detail-modal"
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleStyle}
    >
      <BottomSheetView style={styles.content}>
        {/* Task Title */}
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">
          {task.title}
        </Text>

        {/* Category Badge */}
        {(() => {
          const category = (task.metadata as { category?: string })?.category;
          return (
            category && (
              <View className="mt-2">
                <CategoryBadge category={category} />
              </View>
            )
          );
        })()}

        {/* Time */}
        <View className="mt-4 flex-row items-center gap-2">
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {translate('calendar.task_detail.time')}:
          </Text>
          <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
            {time}
          </Text>
        </View>

        {/* Description */}
        <View className="mt-3">
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {translate('calendar.task_detail.description')}:
          </Text>
          <Text className="mt-1 text-base text-neutral-700 dark:text-neutral-200">
            {task.description || noDescription}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="mt-6 flex-row gap-3">
          {onComplete && (
            <ActionButton
              icon={<Check size={20} color={colors.success[600]} />}
              label={translate('calendar.task_detail.complete')}
              variant="success"
              onPress={handleComplete}
              testID="task-detail-complete"
            />
          )}
          {onEdit && (
            <ActionButton
              icon={<ArrowRight color={colors.neutral[600]} />}
              label={translate('calendar.task_detail.edit')}
              variant="default"
              onPress={handleEdit}
              testID="task-detail-edit"
            />
          )}
          {onDelete && (
            <ActionButton
              icon={<Trash size={20} color={colors.danger[600]} />}
              label={translate('calendar.task_detail.delete')}
              variant="danger"
              onPress={handleDelete}
              testID="task-detail-delete"
            />
          )}
        </View>
      </BottomSheetView>
    </Modal>
  );
}

export { useModal as useTaskDetailModal };

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
