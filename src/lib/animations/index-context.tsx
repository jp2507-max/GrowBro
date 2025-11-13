/**
 * AnimatedIndexContext
 * Shared value context for index-driven onboarding animations
 *
 * Based on makeitanimated reference: lib/animated-index-context.tsx
 * Enables synchronized animations across pager slides without prop drilling
 */

import React, { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

type AnimatedIndexContextValue = {
  activeIndex: SharedValue<number>;
};

const AnimatedIndexContext = createContext<AnimatedIndexContextValue | null>(
  null
);

type AnimatedIndexProviderProps = {
  children: React.ReactNode;
  activeIndex: SharedValue<number>;
};

export function AnimatedIndexProvider({
  children,
  activeIndex,
}: AnimatedIndexProviderProps): React.ReactElement {
  const value = React.useMemo(() => ({ activeIndex }), [activeIndex]);
  return (
    <AnimatedIndexContext.Provider value={value}>
      {children}
    </AnimatedIndexContext.Provider>
  );
}

export function useAnimatedIndex(): SharedValue<number> {
  const context = useContext(AnimatedIndexContext);
  if (!context) {
    throw new Error(
      'useAnimatedIndex must be used within AnimatedIndexProvider'
    );
  }
  return context.activeIndex;
}
