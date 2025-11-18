import type { FlashListRef } from '@shopify/flash-list';
import React from 'react';
import {
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

import type { ScrollDirectionValue } from '@/lib/animations/use-scroll-direction';
import { useScrollDirection } from '@/lib/animations/use-scroll-direction';

export type AnimatedScrollListContextType = {
  listRef: React.RefObject<FlashListRef<unknown> | null>;
  listOffsetY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  scrollDirection: ScrollDirectionValue;
  offsetYAnchorOnBeginDrag: SharedValue<number>;
  offsetYAnchorOnChangeDirection: SharedValue<number>;
  velocityOnEndDrag: SharedValue<number>;
  listPointerEvents: SharedValue<boolean>;
  scrollHandler: (event: ReanimatedScrollEvent) => void;
  enableAutoScrollLock: (durationMs?: number) => void;
};

const AnimatedScrollListContext =
  React.createContext<AnimatedScrollListContextType | null>(null);

export function AnimatedScrollListProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const listRef = React.useRef<FlashListRef<unknown> | null>(null);
  const listOffsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const velocityOnEndDrag = useSharedValue(0);
  const listPointerEvents = useSharedValue(true);
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

  const {
    scrollDirection,
    offsetYAnchorOnBeginDrag,
    offsetYAnchorOnChangeDirection,
    onBeginDrag: scrollDirectionOnBeginDrag,
    onScroll: scrollDirectionOnScroll,
    onEndDrag: scrollDirectionOnEndDrag,
  } = useScrollDirection();

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: (e: ReanimatedScrollEvent) => {
      'worklet';
      isDragging.value = true;
      listPointerEvents.value = true;
      velocityOnEndDrag.value = 0;
      scrollDirectionOnBeginDrag(e);
    },
    onScroll: (e: ReanimatedScrollEvent) => {
      'worklet';
      listOffsetY.value = e.contentOffset.y;
      scrollDirectionOnScroll(e);
    },
    onEndDrag: (e: ReanimatedScrollEvent) => {
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
