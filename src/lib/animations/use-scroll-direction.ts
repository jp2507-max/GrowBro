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

  const onBeginDrag = (e: ReanimatedScrollEvent) => {
    'worklet';
    offsetYAnchorOnBeginDrag.value = e.contentOffset.y;
  };

  const onScroll = (e: ReanimatedScrollEvent) => {
    'worklet';
    const offsetY = e.contentOffset.y;
    const positiveOffsetY =
      param === 'include-negative' ? offsetY : Math.max(offsetY, 0);
    const positivePrevOffsetY =
      param === 'include-negative'
        ? prevOffsetY.value
        : Math.max(prevOffsetY.value, 0);

    if (
      positivePrevOffsetY - positiveOffsetY < 0 &&
      (scrollDirection.value === 'idle' || scrollDirection.value === 'to-top')
    ) {
      scrollDirection.value = 'to-bottom';
      offsetYAnchorOnChangeDirection.value = offsetY;
    }
    if (
      positivePrevOffsetY - positiveOffsetY > 0 &&
      (scrollDirection.value === 'idle' ||
        scrollDirection.value === 'to-bottom')
    ) {
      scrollDirection.value = 'to-top';
      offsetYAnchorOnChangeDirection.value = offsetY;
    }
    prevOffsetY.value = offsetY;
  };

  const onEndDrag = () => {
    'worklet';
    prevOffsetY.value = 0;
  };

  const reset = () => {
    'worklet';
    scrollDirection.value = 'idle';
    prevOffsetY.value = 0;
    offsetYAnchorOnBeginDrag.value = 0;
    offsetYAnchorOnChangeDirection.value = 0;
  };

  // JS thread version - shared value assignments are thread-safe
  const resetFromJS = () => {
    scrollDirection.value = 'idle';
    prevOffsetY.value = 0;
    offsetYAnchorOnBeginDrag.value = 0;
    offsetYAnchorOnChangeDirection.value = 0;
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
