/* eslint-disable react-compiler/react-compiler */
import React from 'react';
import {
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import type { ScrollDirectionValue } from '@/lib/animations/use-scroll-direction';
import { useScrollDirection } from '@/lib/animations/use-scroll-direction';

type AnimatedScrollListContextType = {
  listRef: React.RefObject<any | null>;
  listOffsetY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  scrollDirection: ScrollDirectionValue;
  offsetYAnchorOnBeginDrag: SharedValue<number>;
  offsetYAnchorOnChangeDirection: SharedValue<number>;
  velocityOnEndDrag: SharedValue<number>;
  listPointerEvents: SharedValue<boolean>;
  scrollHandler: any;
  enableAutoScrollLock: (durationMs?: number) => void;
};

const AnimatedScrollListContext =
  React.createContext<AnimatedScrollListContextType | null>(null);

function useScrollSharedValues() {
  const listOffsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const velocityOnEndDrag = useSharedValue(0);
  const listPointerEvents = useSharedValue(true);

  return {
    listOffsetY,
    isDragging,
    velocityOnEndDrag,
    listPointerEvents,
  };
}

function usePointerLock(listPointerEvents: SharedValue<boolean>) {
  const pointerLockTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const enableAutoScrollLock = React.useCallback(
    (durationMs = 300) => {
      listPointerEvents.value = false;
      if (pointerLockTimeout.current) {
        clearTimeout(pointerLockTimeout.current);
      }
      pointerLockTimeout.current = setTimeout(() => {
        listPointerEvents.value = true;
        pointerLockTimeout.current = null;
      }, durationMs);
    },
    [listPointerEvents]
  );

  React.useEffect(() => {
    return () => {
      if (pointerLockTimeout.current) {
        clearTimeout(pointerLockTimeout.current);
        pointerLockTimeout.current = null;
      }
    };
  }, []);

  return enableAutoScrollLock;
}

export function AnimatedScrollListProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const listRef = React.useRef<any>(null);
  const sharedValues = useScrollSharedValues();
  const { listOffsetY, isDragging, velocityOnEndDrag, listPointerEvents } =
    sharedValues;

  const {
    scrollDirection,
    offsetYAnchorOnBeginDrag,
    offsetYAnchorOnChangeDirection,
    onBeginDrag: scrollDirectionOnBeginDrag,
    onScroll: scrollDirectionOnScroll,
    onEndDrag: scrollDirectionOnEndDrag,
  } = useScrollDirection();
  const enableAutoScrollLock = usePointerLock(listPointerEvents);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: (e: any) => {
      'worklet';
      isDragging.value = true;
      listPointerEvents.value = true;
      velocityOnEndDrag.value = 0;
      scrollDirectionOnBeginDrag(e);
    },
    onScroll: (e: any) => {
      'worklet';
      listOffsetY.value = e.contentOffset.y;
      scrollDirectionOnScroll(e);
    },
    onEndDrag: (e: any) => {
      'worklet';
      isDragging.value = false;
      velocityOnEndDrag.value = e.velocity?.y ?? 0;
      scrollDirectionOnEndDrag();
    },
    onMomentumEnd: () => {
      'worklet';
      velocityOnEndDrag.value = 0;
      listPointerEvents.value = true;
    },
  });

  return (
    <AnimatedScrollListContext.Provider
      value={{
        listRef,
        listOffsetY,
        isDragging,
        scrollDirection,
        offsetYAnchorOnBeginDrag,
        offsetYAnchorOnChangeDirection,
        velocityOnEndDrag,
        listPointerEvents,
        scrollHandler,
        enableAutoScrollLock,
      }}
    >
      {children}
    </AnimatedScrollListContext.Provider>
  );
}

export function useAnimatedScrollList(): AnimatedScrollListContextType {
  const ctx = React.useContext(AnimatedScrollListContext);
  if (!ctx)
    throw new Error(
      'useAnimatedScrollList must be used within AnimatedScrollListProvider'
    );
  return ctx;
}
