/**
 * Example: Sortable Day View
 *
 * This is a reference implementation showing how to integrate DaySortableList
 * into a calendar day view with proper auto-scroll, undo, and accessibility.
 *
 * Usage:
 * 1. Import this component in your calendar screen
 * 2. Pass date and tasks for that day
 * 3. Enable via ENABLE_SORTABLES_CALENDAR feature flag
 */

import { Env } from '@env';
import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { SortableGridRenderItem } from 'react-native-sortables';

import { AgendaItemRow } from '@/components/calendar/agenda-item';
import { DaySortableList } from '@/components/calendar/day-sortable-list';
import { Text, View } from '@/components/ui';
import { useTaskReorder } from '@/lib/hooks/use-task-reorder';
import type { Task } from '@/types/calendar';

type Props = {
  date: Date;
  tasks: Task[];
  /**
   * Optional callback for when tasks are reordered
   */
  onTasksReordered?: (tasks: Task[]) => void;
};

export function SortableDayView({
  date,
  tasks,
  onTasksReordered,
}: Props): React.ReactElement {
  const scrollRef = React.useRef<any>(null);
  const { handleTaskReorder } = useTaskReorder();

  // Render each task with drag handle enabled
  const renderItem = useCallback<SortableGridRenderItem<Task>>(
    ({ item }) => <AgendaItemRow task={item} showDragHandle={true} />,
    []
  );

  // Handle drag end event
  const onDragEnd = useCallback(
    (params: {
      data: Task[];
      fromIndex: number;
      toIndex: number;
      key: string;
    }) => {
      // Update task positions and show undo toast
      void handleTaskReorder({
        data: params.data,
      });

      // Notify parent component if callback provided
      if (onTasksReordered) {
        onTasksReordered(params.data);
      }
    },
    [handleTaskReorder, onTasksReordered]
  );

  // Key extractor for tasks
  const keyExtractor = useCallback((task: Task, _index: number) => task.id, []);

  // Format date for display
  const dateString = React.useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString(undefined, options);
  }, [date]);

  // Feature flag check
  const sortablesEnabled = Env.ENABLE_SORTABLES_CALENDAR ?? false;

  if (!sortablesEnabled) {
    // Fallback: render simple list without sortable functionality
    return (
      <View style={styles.container} testID="sortable-day-view-disabled">
        <View style={styles.header}>
          <Text className="text-lg font-semibold">{dateString}</Text>
        </View>
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <AgendaItemRow key={task.id} task={task} showDragHandle={false} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID="sortable-day-view"
    >
      <View style={styles.header}>
        <Text className="text-lg font-semibold">{dateString}</Text>
        <Text className="text-xs text-neutral-500">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </Text>
      </View>

      {tasks.length > 0 ? (
        <DaySortableList
          data={tasks}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onDragEnd={onDragEnd}
          scrollableRef={scrollRef}
          enableSort={true}
          testID="day-sortable-list"
        />
      ) : (
        <View style={styles.emptyState}>
          <Text className="text-neutral-500">No tasks for this day</Text>
        </View>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
    gap: 4,
  },
  taskList: {
    gap: 8,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
