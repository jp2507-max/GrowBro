/**
 * Hook to compose scroll handlers for FlashList with performance monitoring.
 */

import { useCallback, useMemo } from 'react';
import {
  useAnimatedScrollHandler,
  useComposedEventHandler,
} from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';
import { scheduleOnRN } from 'react-native-worklets';

import { useStrainListPerformance } from '@/lib/strains/use-strain-list-performance';

type AnimatedScrollHandler = (event: ReanimatedScrollEvent) => void;

type UseListScrollingOptions = {
  /** External scroll handler to compose with performance monitoring */
  onScroll?: AnimatedScrollHandler;
  /** Current list size for performance metrics */
  listSize: number;
};

type UseListScrollingResult = {
  /** Composed scroll handler including performance monitoring */
  composedScrollHandler: AnimatedScrollHandler;
};

/**
 * Composes scroll handlers for FlashList including performance monitoring.
 */
export function useListScrolling({
  onScroll,
  listSize,
}: UseListScrollingOptions): UseListScrollingResult {
  const { handleScroll: handlePerfScroll } = useStrainListPerformance({
    listSize,
  });

  const handlePerfScrollJS = useCallback((): void => {
    handlePerfScroll();
  }, [handlePerfScroll]);

  const perfScrollHandler = useAnimatedScrollHandler({
    onEnd: () => {
      scheduleOnRN(handlePerfScrollJS);
    },
  });

  // Filter out undefined handlers for TypeScript-safe composition
  const scrollHandlers = useMemo(
    () =>
      [onScroll, perfScrollHandler].filter(
        (handler): handler is AnimatedScrollHandler => handler !== undefined
      ),
    [onScroll, perfScrollHandler]
  );

  const composedScrollHandler = useComposedEventHandler(scrollHandlers);

  return { composedScrollHandler };
}
