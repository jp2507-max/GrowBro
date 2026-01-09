// Simplified mock for react-native-gesture-handler compatible with current version
// Provides minimal chainable Gesture API used in tests and a pass-through GestureDetector.
// This avoids importing internal non-public paths that break type checking.

import type * as React from 'react';

type Chain = Record<string, any>;

function createChain(): Chain {
  const chain: Chain = {
    activateAfterLongPress: () => chain,
    minDistance: () => chain,
    onBegin: () => chain,
    onStart: () => chain,
    onUpdate: () => chain,
    onEnd: () => chain,
    onFinalize: () => chain,
  };
  return chain;
}

export const Gesture = {
  Pan: () => createChain(),
  Tap: () => createChain(),
  LongPress: () => createChain(),
  Fling: () => createChain(),
  Native: () => createChain(),
  Pinch: () => createChain(),
  Rotation: () => createChain(),
  Hover: () => createChain(),
  ForceTouch: () => createChain(),
  Manual: () => createChain(),
  Simultaneous: (..._args: any[]) => createChain(),
};

export type GestureType = ReturnType<typeof Gesture.Pan>;

export const GestureDetector = ({ children }: { children: React.ReactNode }) =>
  children as any;

export const GestureHandlerRootView = ({
  children,
}: {
  children: React.ReactNode;
}) => children as any;

export const State = {};
export default { Gesture, GestureDetector, GestureHandlerRootView };
