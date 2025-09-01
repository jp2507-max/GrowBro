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

export function DraggableAgendaItem({ task }: Props): React.ReactElement {
  const {
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    computeTargetDate,
  } = useDragDrop();

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const originDate = React.useRef<Date>(new Date(task.dueAtLocal));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .minDistance(1)
        .onStart(() => {
          tx.value = 0;
          ty.value = 0;
          runOnJS(startDrag)(task);
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY;
          runOnJS(onDragUpdate)(e.absoluteY);
        })
        .onEnd(() => {
          const target = computeTargetDate(originDate.current, ty.value);
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
    ]
  );

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
