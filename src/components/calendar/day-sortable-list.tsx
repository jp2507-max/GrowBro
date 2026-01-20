import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { SortableGridRenderItem } from 'react-native-sortables';
import Sortable from 'react-native-sortables';
import { scheduleOnRN } from 'react-native-worklets';

import type { Task } from '@/types/calendar';

type Props = {
  /**
   * Array of tasks for a single day
   */
  data: Task[];
  /**
   * Function to extract unique key from task
   */
  keyExtractor: (task: Task, index: number) => string;
  /**
   * Render function for each task item
   */
  renderItem: SortableGridRenderItem<Task>;
  /**
   * Callback when drag ends with new order
   */
  onDragEnd?: (params: {
    key: string;
    fromIndex: number;
    toIndex: number;
    data: Task[];
  }) => void;
  /**
   * Whether sorting is enabled
   */
  enableSort?: boolean;
  /**
   * Ref to the parent scrollable for auto-scroll support
   */
  scrollableRef?: React.RefObject<{
    scrollToOffset: (params: { offset: number; animated: boolean }) => void;
  } | null>;
  /**
   * Optional container style
   */
  style?: ViewStyle;
  /**
   * Optional test ID
   */
  testID?: string;
};

/**
 * DaySortableList - Sortable container for tasks within a single day.
 * Uses Sortable.Grid with customHandle enabled to allow reordering via drag handle
 * while preserving date-move gestures on the task body.
 *
 * Key features:
 * - Single column grid (vertical list)
 * - Custom drag handle support
 * - Auto-scroll when dragging near edges
 * - Worklet callbacks for performance
 * - Reduced motion support
 */
export function DaySortableList({
  data,
  keyExtractor,
  renderItem,
  onDragEnd,
  enableSort = true,
  scrollableRef,
  style,
  testID = 'day-sortable-list',
}: Props): React.ReactElement {
  // Worklet callback for drag end
  const handleDragEnd = React.useCallback(
    (params: {
      key: string;
      fromIndex: number;
      toIndex: number;
      indexToKey: string[];
      keyToIndex: Record<string, number>;
      data: Task[];
    }) => {
      'worklet';
      // Call the provided onDragEnd handler if present
      if (onDragEnd) {
        scheduleOnRN(onDragEnd, {
          key: params.key,
          fromIndex: params.fromIndex,
          toIndex: params.toIndex,
          data: params.data,
        });
      }
    },
    [onDragEnd]
  );

  // If sorting is disabled, render a simple list
  if (!enableSort || data.length === 0) {
    return (
      <Animated.View style={[styles.container, style]} testID={testID}>
        {data.map((task, index) => {
          const key = keyExtractor(task, index);
          return (
            <React.Fragment key={key}>
              {renderItem({ item: task, index })}
            </React.Fragment>
          );
        })}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, style]} testID={testID}>
      <Sortable.Grid
        columns={1}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor as (item: Task) => string}
        onDragEnd={handleDragEnd}
        customHandle // Enables custom drag handle
        scrollableRef={scrollableRef}
        autoScrollEnabled
        autoScrollActivationOffset={75}
        rowGap={0}
        columnGap={0}
        overDrag="vertical"
        activeItemScale={1.02}
        dragActivationDelay={200}
        activationAnimationDuration={150}
        dropAnimationDuration={200}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
