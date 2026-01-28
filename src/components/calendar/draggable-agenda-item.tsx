import React from 'react';
import type { AccessibilityActionEvent } from 'react-native';
import { StyleSheet } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AgendaItemRow } from '@/components/calendar/agenda-item';
import {
  type DragScope,
  useDragDrop,
} from '@/components/calendar/drag-drop-provider';
import { MoveToDateMenu } from '@/components/calendar/move-to-date-menu';
import { View } from '@/components/ui';
import { SPRING } from '@/lib/animations/constants';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

type Props = {
  task: Task;
  testID?: string;
};

type AgendaItemBodyProps = {
  gesture: GestureType;
  // Using loose typing for animated style to accommodate Reanimated's internal types
  animatedStyle: AnimatedStyle;
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onAction: (event: AccessibilityActionEvent) => void;
  testID?: string;
};

function AgendaItemBody({
  gesture,
  animatedStyle,
  task,
  isOpen,
  onClose,
  onAction,
  testID,
}: AgendaItemBodyProps): React.ReactElement {
  const targets = extractTargets(task);
  // Pass handler directly; no need to wrap with useCallback
  return (
    <GestureDetector gesture={gesture}>
      <View>
        <Animated.View
          style={[animatedStyle, styles.body]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={translate('calendar.drag_item_label', {
            title: task.title,
          })}
          accessibilityHint={translate('calendar.drag_item_hint')}
          accessibilityActions={[
            { name: 'activate', label: translate('calendar.move_to_date') },
            { name: 'increment', label: translate('calendar.tomorrow') },
            { name: 'decrement', label: translate('calendar.yesterday') },
          ]}
          onAccessibilityAction={onAction}
        >
          <AgendaItemRow task={task} testID={testID} />
        </Animated.View>

        <MoveToDateMenu
          open={isOpen}
          onClose={onClose}
          anchorDate={new Date(task.dueAtLocal)}
          targets={targets}
          onLogPress={handleLogPress}
        />
      </View>
    </GestureDetector>
  );
}

function extractTargets(
  task: Task
):
  | { phMin: number; phMax: number; ecMin25c: number; ecMax25c: number }
  | undefined {
  const meta = task.metadata ?? {};
  const t = meta?.targets as
    | {
        phMin?: number;
        phMax?: number;
        ecMin25c?: number;
        ecMax25c?: number;
      }
    | undefined;
  if (
    t &&
    typeof t.phMin === 'number' &&
    typeof t.phMax === 'number' &&
    typeof t.ecMin25c === 'number' &&
    typeof t.ecMax25c === 'number'
  ) {
    return {
      phMin: t.phMin,
      phMax: t.phMax,
      ecMin25c: t.ecMin25c,
      ecMax25c: t.ecMax25c,
    };
  }
  return undefined;
}

function handleLogPress(): void {
  // Placeholder: navigate when logging screen exists

  console.log('log ph/ec pressed');
}

// Custom hook to create pan gesture

function useCreatePanGesture(options: {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  originTime: SharedValue<number>;
  originTimeAtDragStart: SharedValue<number>;
  task: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  setAutoScrollDirection: (dir: -1 | 0 | 1) => void;
  viewportHeightShared: SharedValue<number>;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
}): GestureType {
  const {
    tx,
    ty,
    originTime,
    originTimeAtDragStart,
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
    viewportHeightShared,
    computeTargetDate,
  } = options;

  const autoScrollDirection = useSharedValue<-1 | 0 | 1>(0);
  const autoScrollEdgeThreshold = 60;

  const onDropJS = React.useCallback(
    (originMs: number, dy: number): void => {
      const origin = new Date(originMs);
      const target = computeTargetDate(origin, dy);
      void completeDrop(target, 'occurrence' as DragScope);
    },
    [completeDrop, computeTargetDate]
  );

  return React.useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .minDistance(1)
        .onStart(() => {
          tx.set(0);
          ty.set(0);
          originTimeAtDragStart.set(originTime.get());
          autoScrollDirection.set(0);
          scheduleOnRN(setAutoScrollDirection, 0);
          scheduleOnRN(startDrag, task);
        })
        .onUpdate((e) => {
          tx.set(e.translationX);
          ty.set(e.translationY);
          const viewportHeight = viewportHeightShared.get();
          let dir: -1 | 0 | 1 = 0;
          if (viewportHeight > 0) {
            if (e.absoluteY < autoScrollEdgeThreshold) {
              dir = -1;
            } else if (e.absoluteY > viewportHeight - autoScrollEdgeThreshold) {
              dir = 1;
            }
          }
          if (dir !== autoScrollDirection.get()) {
            autoScrollDirection.set(dir);
            scheduleOnRN(setAutoScrollDirection, dir);
          }
        })
        .onEnd(() => {
          scheduleOnRN(onDropJS, originTimeAtDragStart.get(), ty.get());
          autoScrollDirection.set(0);
          scheduleOnRN(setAutoScrollDirection, 0);
          tx.set(withSpring(0, SPRING));
          ty.set(withSpring(0, SPRING));
        })
        .onFinalize(() => {
          autoScrollDirection.set(0);
          scheduleOnRN(setAutoScrollDirection, 0);
          scheduleOnRN(cancelDrag);
        }),
    [
      cancelDrag,
      onDropJS,
      setAutoScrollDirection,
      startDrag,
      task,
      tx,
      ty,
      originTime,
      originTimeAtDragStart,
      viewportHeightShared,
      autoScrollDirection,
    ]
  );
}

// Custom hook for managing drag gesture logic
function useDragGesture(options: {
  task: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  setAutoScrollDirection: (dir: -1 | 0 | 1) => void;
  viewportHeightShared: SharedValue<number>;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
}) {
  const {
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
    viewportHeightShared,
    computeTargetDate,
  } = options;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const initialOriginTime = new Date(task.dueAtLocal).getTime();
  const originTime = useSharedValue(initialOriginTime);
  const originTimeAtDragStart = useSharedValue(initialOriginTime);

  React.useEffect(() => {
    originTime.set(new Date(task.dueAtLocal).getTime());
  }, [originTime, task.dueAtLocal]);

  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: tx.get() }, { translateY: ty.get() }],
    }),
    []
  );

  const pan = useCreatePanGesture({
    tx,
    ty,
    originTime,
    originTimeAtDragStart,
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
    viewportHeightShared,
    computeTargetDate,
  });

  return { pan, animatedStyle };
}

export function DraggableAgendaItem({
  task,
  testID,
}: Props): React.ReactElement {
  const {
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
    computeTargetDate,
    viewportHeightShared,
  } = useDragDrop();

  const { pan, animatedStyle } = useDragGesture({
    task,
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
    viewportHeightShared,
    computeTargetDate,
  });

  const [isMoveMenuOpen, setIsMoveMenuOpen] = React.useState<boolean>(false);

  const onAccessibilityAction = React.useCallback(
    async (event: AccessibilityActionEvent) => {
      const action = event?.nativeEvent?.actionName as
        | 'activate'
        | 'increment'
        | 'decrement'
        | string;
      if (action === 'activate') {
        setIsMoveMenuOpen(true);
        return;
      }
      if (action === 'increment' || action === 'decrement') {
        const anchor = new Date(task.dueAtLocal);
        const delta = action === 'increment' ? 1 : -1;
        const target = new Date(
          anchor.getFullYear(),
          anchor.getMonth(),
          anchor.getDate() + delta
        );
        await completeDrop(target, 'occurrence' as DragScope);
      }
    },
    [completeDrop, task.dueAtLocal]
  );

  return (
    <AgendaItemBody
      gesture={pan}
      animatedStyle={animatedStyle}
      task={task}
      isOpen={isMoveMenuOpen}
      onClose={() => setIsMoveMenuOpen(false)}
      onAction={onAccessibilityAction}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    minHeight: 44,
  },
});
