import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import type {
  AdjustmentSuggestion,
  TaskAdjustment,
} from '@/types/ai-adjustments';

import { Text, View } from '../ui';

type Props = {
  suggestion: AdjustmentSuggestion;
  onAcceptAll: () => void;
  onAcceptPartial: (taskIds: string[]) => void;
  onDecline: () => void;
  onClose: () => void;
};

function ModalHeader({
  onClose,
  confidence,
  taskCount,
}: {
  onClose: () => void;
  confidence: number;
  taskCount: number;
}) {
  const confidencePercent = Math.round(confidence * 100);
  return (
    <View className="border-b border-neutral-200 p-4 dark:border-neutral-800">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Schedule Adjustment
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="rounded-full p-2"
          testID="close-button"
        >
          <Text className="text-neutral-500 dark:text-neutral-400">✕</Text>
        </Pressable>
      </View>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {confidencePercent}% confidence • {taskCount} tasks
      </Text>
    </View>
  );
}

function ReasoningSection({ reasoning }: { reasoning: string }) {
  return (
    <View className="dark:bg-primary-950 mb-4 rounded-lg bg-primary-50 p-4">
      <Text className="mb-1 font-semibold text-primary-900 dark:text-primary-100">
        Why this adjustment?
      </Text>
      <Text className="text-sm text-primary-800 dark:text-primary-200">
        {reasoning}
      </Text>
    </View>
  );
}

function TaskListSection({
  tasks,
  selectedTasks,
  onToggle,
}: {
  tasks: TaskAdjustment[];
  selectedTasks: Set<string>;
  onToggle: (taskId: string) => void;
}) {
  return (
    <>
      <Text className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">
        Affected Tasks
      </Text>
      <Text className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
        Select which tasks to adjust
      </Text>
      {tasks.map((task) => (
        <TaskAdjustmentRow
          key={task.taskId}
          task={task}
          selected={selectedTasks.has(task.taskId)}
          onToggle={() => onToggle(task.taskId)}
        />
      ))}
    </>
  );
}

function ActionButtons({
  onAcceptAll,
  onAcceptPartial,
  onDecline,
  selectedCount,
}: {
  onAcceptAll: () => void;
  onAcceptPartial: () => void;
  onDecline: () => void;
  selectedCount: number;
}) {
  return (
    <View className="border-t border-neutral-200 p-4 dark:border-neutral-800">
      <View className="mb-2 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onAcceptAll}
          className="flex-1 rounded-lg bg-success-600 px-4 py-3 active:bg-success-700"
          testID="accept-all-button"
        >
          <Text className="text-center font-semibold text-white">
            Accept All
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onAcceptPartial}
          disabled={selectedCount === 0}
          className="flex-1 rounded-lg bg-primary-600 px-4 py-3 active:bg-primary-700 disabled:opacity-50"
          testID="accept-selected-button"
        >
          <Text className="text-center font-semibold text-white">
            Accept Selected ({selectedCount})
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onDecline}
        className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700"
        testID="decline-button"
      >
        <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
          Decline
        </Text>
      </Pressable>
    </View>
  );
}

function useTaskSelection(suggestion: AdjustmentSuggestion) {
  const [selectedTasks, setSelectedTasks] = React.useState<Set<string>>(
    new Set(suggestion.affectedTasks.map((t) => t.taskId))
  );

  React.useEffect(() => {
    setSelectedTasks(new Set(suggestion.affectedTasks.map((t) => t.taskId)));
  }, [suggestion]);

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return { selectedTasks, toggleTask };
}

export function AdjustmentPreviewModal({
  suggestion,
  onAcceptAll,
  onAcceptPartial,
  onDecline,
  onClose,
}: Props) {
  const { selectedTasks, toggleTask } = useTaskSelection(suggestion);

  const handleAcceptPartial = () => {
    if (selectedTasks.size === 0) return;
    const currentTaskIds = suggestion.affectedTasks.map((t) => t.taskId);
    const validSelectedTasks = Array.from(selectedTasks).filter((taskId) =>
      currentTaskIds.includes(taskId)
    );
    onAcceptPartial(validSelectedTasks);
  };

  return (
    <View
      className="flex-1 bg-white dark:bg-charcoal-950"
      testID="adjustment-preview-modal"
    >
      <ModalHeader
        onClose={onClose}
        confidence={suggestion.confidence}
        taskCount={suggestion.affectedTasks.length}
      />

      <ScrollView className="flex-1 p-4">
        <ReasoningSection reasoning={suggestion.reasoning} />
        <TaskListSection
          tasks={suggestion.affectedTasks}
          selectedTasks={selectedTasks}
          onToggle={toggleTask}
        />
        <View className="mt-4 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            ⚠️ This is an AI-generated suggestion based on your grow patterns.
            It is educational guidance, not professional advice. You can accept
            all, some, or none of these changes.
          </Text>
        </View>
      </ScrollView>

      <ActionButtons
        onAcceptAll={onAcceptAll}
        onAcceptPartial={handleAcceptPartial}
        onDecline={onDecline}
        selectedCount={selectedTasks.size}
      />
    </View>
  );
}

type TaskRowProps = {
  task: TaskAdjustment;
  selected: boolean;
  onToggle: () => void;
};

function TaskAdjustmentRow({ task, selected, onToggle }: TaskRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      className="mb-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
      testID={`task-row-${task.taskId}`}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-medium text-neutral-900 dark:text-neutral-100">
            Task #{task.taskId.slice(0, 8)}
          </Text>
          {task.phase && (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              Phase {task.phase}
            </Text>
          )}
        </View>
        <View
          className={`size-5 rounded border-2 ${
            selected
              ? 'border-primary-600 bg-primary-600'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        >
          {selected && (
            <Text className="text-center text-xs text-white">✓</Text>
          )}
        </View>
      </View>

      <View className="mb-2 flex-row items-center gap-2">
        <Text className="text-sm text-neutral-600 line-through dark:text-neutral-400">
          {formatDate(task.currentDueDate)}
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400">→</Text>
        <Text className="text-sm font-medium text-success-600 dark:text-success-400">
          {formatDate(task.proposedDueDate)}
        </Text>
      </View>

      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {task.reason}
      </Text>
    </Pressable>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
