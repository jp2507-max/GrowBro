import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AgendaItemRow } from '@/components/calendar/agenda-item';
import { useDragDrop } from '@/components/calendar/drag-drop-provider';
import type { Task } from '@/types/calendar';

type Props = {
  task: Task;
};

// Custom hook to create pan gesture
// eslint-disable-next-line max-lines-per-function
function useCreatePanGesture(options: {
  tx: Animated.SharedValue<number>;
  ty: Animated.SharedValue<number>;
  originDate: React.RefObject<Date>;
  task: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: string) => Promise<void>;
  onDragUpdate: (y: number) => number | undefined;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
  updateCurrentOffset: (y: number) => void;
}) {
  const {
    tx,
    ty,
    originDate,
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
    updateCurrentOffset,
  } = options;

  return React.useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .minDistance(1)
        .onStart(() => {
          // eslint-disable-next-line react-compiler/react-compiler
          tx.value = 0;

          ty.value = 0;
          runOnJS(startDrag)(task);
        })
        .onUpdate((e) => {
          tx.value = e.translationX;

          ty.value = e.translationY;
          runOnJS(() => {
            const newOffset = onDragUpdate(e.absoluteY);
            if (newOffset !== undefined) {
              updateCurrentOffset(newOffset);
            }
          })();
        })
        .onEnd(() => {
          const target = computeTargetDate(originDate.current!, ty.value);
          runOnJS(completeDrop)(target, 'occurrence');

          tx.value = withSpring(0);

          ty.value = withSpring(0);
        })
        .onFinalize(() => {
          runOnJS(cancelDrag)();
        }),
    [
      cancelDrag,
      completeDrop,
      computeTargetDate,
      onDragUpdate,
      startDrag,
      task,
      tx,
      ty,
      updateCurrentOffset,
      originDate,
    ]
  );
}

// Custom hook for managing drag gesture logic
function useDragGesture(options: {
  task: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: string) => Promise<void>;
  onDragUpdate: (y: number) => number | undefined;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
  updateCurrentOffset: (y: number) => void;
}) {
  const {
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
    updateCurrentOffset,
  } = options;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const originDate = React.useRef<Date>(new Date(task.dueAtLocal));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const pan = useCreatePanGesture({
    tx,
    ty,
    originDate,
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
    updateCurrentOffset,
  });

  return { pan, animatedStyle };
}

export function DraggableAgendaItem({ task }: Props): React.ReactElement {
  const {
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
    updateCurrentOffset,
  } = useDragDrop();

  const { pan, animatedStyle } = useDragGesture({
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
    updateCurrentOffset,
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={animatedStyle}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Drag ${task.title}`}
      >
        <AgendaItemRow task={task} />
      </Animated.View>
    </GestureDetector>
  );
}
