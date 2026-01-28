import type { FlashListRef } from '@shopify/flash-list';
import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
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
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  enableAutoScrollLock: (durationMs?: number) => void;
  /** Reset all scroll state to neutral values so the tab bar becomes visible */
  resetScrollState: () => void;
};

const AnimatedScrollListContext =
  React.createContext<AnimatedScrollListContextType | null>(null);

// eslint-disable-next-line max-lines-per-function
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
  const pointerLockTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const scrollDir = useScrollDirection();

  const enableAutoScrollLock = React.useCallback(
    (durationMs = 300) => {
      listPointerEvents.set(false);
      if (pointerLockTimeout.current) clearTimeout(pointerLockTimeout.current);
      pointerLockTimeout.current = setTimeout(() => {
        listPointerEvents.set(true);
        pointerLockTimeout.current = null;
      }, durationMs);
    },
    [listPointerEvents]
  );

  React.useEffect(
    () => () => {
      if (pointerLockTimeout.current) clearTimeout(pointerLockTimeout.current);
    },
    []
  );

  // Reset scroll state - shared value assignments are thread-safe from JS
  const resetScrollState = React.useCallback(() => {
    listOffsetY.set(0);
    isDragging.set(false);
    velocityOnEndDrag.set(0);
    listPointerEvents.set(true);
    scrollDir.resetFromJS();
  }, [
    listOffsetY,
    isDragging,
    velocityOnEndDrag,
    listPointerEvents,
    scrollDir,
  ]);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: (e: ReanimatedScrollEvent) => {
      isDragging.set(true);
      listPointerEvents.set(true);
      velocityOnEndDrag.set(0);
      scrollDir.onBeginDrag(e);
    },
    onScroll: (e: ReanimatedScrollEvent) => {
      listOffsetY.set(e.contentOffset.y);
      scrollDir.onScroll(e);
    },
    onEndDrag: (e: ReanimatedScrollEvent) => {
      isDragging.set(false);
      velocityOnEndDrag.set(e.velocity?.y ?? 0);
      scrollDir.onEndDrag();
    },
    onMomentumEnd: () => {
      velocityOnEndDrag.set(0);
      listPointerEvents.set(true);
    },
  });

  return (
    <AnimatedScrollListContext.Provider
      value={{
        listRef,
        listOffsetY,
        isDragging,
        scrollDirection: scrollDir.scrollDirection,
        offsetYAnchorOnBeginDrag: scrollDir.offsetYAnchorOnBeginDrag,
        offsetYAnchorOnChangeDirection:
          scrollDir.offsetYAnchorOnChangeDirection,
        velocityOnEndDrag,
        listPointerEvents,
        scrollHandler,
        enableAutoScrollLock,
        resetScrollState,
      }}
    >
      {children}
    </AnimatedScrollListContext.Provider>
  );
}

export function useAnimatedScrollList(): AnimatedScrollListContextType {
  const ctx = React.useContext(AnimatedScrollListContext);
  if (!ctx) {
    throw new Error(
      'useAnimatedScrollList must be used within AnimatedScrollListProvider'
    );
  }
  return ctx;
}
