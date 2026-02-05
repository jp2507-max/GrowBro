import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

export type ScrollDirection = 'to-top' | 'to-bottom' | 'idle';
export type ScrollDirectionValue = SharedValue<ScrollDirection>;

export function useScrollDirection(param?: 'include-negative'): {
  scrollDirection: ScrollDirectionValue;
  offsetYAnchorOnBeginDrag: SharedValue<number>;
  offsetYAnchorOnChangeDirection: SharedValue<number>;
  onBeginDrag: (e: ReanimatedScrollEvent) => void;
  onScroll: (e: ReanimatedScrollEvent) => void;
  onEndDrag: () => void;
  /** Reset all scroll direction state to neutral (idle) values - worklet version */
  reset: () => void;
  /** Reset all scroll direction state from JS thread */
  resetFromJS: () => void;
} {
  const scrollDirection = useSharedValue<ScrollDirection>('idle');
  const prevOffsetY = useSharedValue(0);
  const offsetYAnchorOnBeginDrag = useSharedValue(0);
  const offsetYAnchorOnChangeDirection = useSharedValue(0);
  const includeNegative = param === 'include-negative';

  const onBeginDrag = (e: ReanimatedScrollEvent): void => {
    'worklet';
    const normalizedOffsetY = includeNegative
      ? e.contentOffset.y
      : Math.max(e.contentOffset.y, 0);
    offsetYAnchorOnBeginDrag.set(normalizedOffsetY);
  };

  const onScroll = (e: ReanimatedScrollEvent): void => {
    'worklet';
    const offsetY = e.contentOffset.y;
    const normalizedOffsetY = includeNegative ? offsetY : Math.max(offsetY, 0);
    const normalizedPrevOffsetY = includeNegative
      ? prevOffsetY.get()
      : Math.max(prevOffsetY.get(), 0);
    const delta = normalizedPrevOffsetY - normalizedOffsetY;

    const currentDirection = scrollDirection.get();

    if (
      delta < 0 &&
      (currentDirection === 'idle' || currentDirection === 'to-top')
    ) {
      scrollDirection.set('to-bottom');
      offsetYAnchorOnChangeDirection.set(normalizedOffsetY);
    } else if (
      delta > 0 &&
      (currentDirection === 'idle' || currentDirection === 'to-bottom')
    ) {
      scrollDirection.set('to-top');
      offsetYAnchorOnChangeDirection.set(normalizedOffsetY);
    }
    prevOffsetY.set(normalizedOffsetY);
  };

  const onEndDrag = (): void => {
    'worklet';
    prevOffsetY.set(0);
  };

  const reset = (): void => {
    'worklet';
    scrollDirection.set('idle');
    prevOffsetY.set(0);
    offsetYAnchorOnBeginDrag.set(0);
    offsetYAnchorOnChangeDirection.set(0);
  };

  // JS thread version - shared value assignments are thread-safe
  const resetFromJS = (): void => {
    scrollDirection.set('idle');
    prevOffsetY.set(0);
    offsetYAnchorOnBeginDrag.set(0);
    offsetYAnchorOnChangeDirection.set(0);
  };

  return {
    scrollDirection,
    offsetYAnchorOnBeginDrag,
    offsetYAnchorOnChangeDirection,
    onBeginDrag,
    onScroll,
    onEndDrag,
    reset,
    resetFromJS,
  };
}
