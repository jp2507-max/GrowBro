// Reanimated compatibility + augmentation shim
// Provides minimal type surface required by dependent libraries (e.g. @gorhom/bottom-sheet)
// when using a version of Reanimated whose type declarations differ.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'react-native-reanimated' {
  import type * as React from 'react';

  // Core animated object (treated as any for flexibility)
  const Animated: any;
  export default Animated;

  // Commonly used hooks & helpers
  export const runOnJS: (...args: any[]) => any;
  export const useAnimatedStyle: (...args: any[]) => any;
  export const useDerivedValue: (...args: any[]) => any;
  export const useSharedValue: <T>(v: T) => { value: T };
  export const useAnimatedReaction: (...args: any[]) => any;
  export const useAnimatedScrollHandler: (...args: any[]) => any;
  export const useComposedEventHandler: (...args: any[]) => any;
  export const withSpring: (...args: any[]) => any;
  export const withTiming: (...args: any[]) => any;
  export const withRepeat: (...args: any[]) => any;
  export const withSequence: (...args: any[]) => any;
  export const withDelay: (...args: any[]) => any;
  export const withClamp: (...args: any[]) => any;

  // Layout / transition helpers (used in modal.tsx)
  export const FadeIn: any;
  export const FadeOut: any;
  export const ReduceMotion: any;

  // Easing stub (older libs import { Easing })
  export const Easing: Record<string, (...args: any[]) => any> & {
    out: (...args: any[]) => any;
    exp: (...args: any[]) => any;
  };

  // Minimal type aliases used by the codebase
  export type SharedValue<T> = { value: T };
  export type AnimatedStyle = any;

  export function createAnimatedComponent<P>(
    component: React.ComponentType<P>
  ): React.ComponentType<P> & any;

  // Legacy namespace members expected by some packages
  namespace Animated {
    type EasingFunction = (value: number) => number;
  }
}
