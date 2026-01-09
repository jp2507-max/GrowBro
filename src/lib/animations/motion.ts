/**
 * Motion tokens and utilities for consistent animations
 * Requirements: 2.3, 12.1
 *
 * Centralizes animation durations and easings for consistent UX
 * and ensures Reduced Motion is always respected.
 */

import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * Standard animation durations (ms)
 */
export const motion = {
  dur: {
    xs: 120, // Micro-interactions (toggle, ripple)
    sm: 180, // Quick transitions (fade, slide)
    md: 260, // Standard transitions (navigation, modal)
    lg: 360, // Complex animations (layout changes)
  },
  ease: {
    standard: Easing.bezier(0.2, 0, 0, 1), // Standard easing
    emphasized: Easing.bezier(0.4, 0, 0.2, 1), // Emphasized motion
    decel: Easing.bezier(0, 0, 0.2, 1), // Deceleration
  },
  spring: {
    header: {
      damping: 22,
      stiffness: 240,
      mass: 0.9,
      reduceMotion: ReduceMotion.System,
    },
  },
} as const;

/**
 * Ensures animation respects system Reduced Motion preference.
 * Supports both Layout Animation builders and timing/spring config objects.
 * Usage:
 *   entering={withRM(FadeIn.duration(motion.dur.md))}
 *   withTiming(1, withRM({ duration: 500 }))
 */
export function withRM<
  T extends
    | { reduceMotion?: (v: typeof ReduceMotion.System) => T }
    | Record<string, unknown>,
>(anim: T): T {
  if (typeof anim.reduceMotion === 'function') {
    return (anim.reduceMotion as (v: typeof ReduceMotion.System) => T)(
      ReduceMotion.System
    );
  }
  return { ...anim, reduceMotion: ReduceMotion.System } as T;
}
