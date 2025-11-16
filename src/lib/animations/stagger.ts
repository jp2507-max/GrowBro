/**
 * Stagger animation helpers
 * Based on makeitanimated patterns for sequential element animations
 *
 * Requirements: 2.3 (Reduced Motion), 12.1 (Accessibility)
 */

import { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { motion } from './motion';

/**
 * Stagger configuration for sequential animations
 */
export type StaggerConfig = {
  baseDelay?: number;
  staggerDelay?: number;
  duration?: number;
};

const DEFAULT_STAGGER: Required<StaggerConfig> = {
  baseDelay: 100,
  staggerDelay: 40,
  duration: 300,
};

/**
 * Creates a staggered FadeIn animation with delay
 * Usage: entering={createStaggeredFadeIn(index)}
 *
 * Note: Using FadeIn instead of FadeInUp for Reanimated 4.x compatibility
 * The fade effect provides smooth, accessible animations across all devices
 */
export function createStaggeredFadeIn(
  index: number,
  config: StaggerConfig = {}
): ReturnType<typeof FadeIn.delay> {
  const { baseDelay, staggerDelay, duration } = {
    ...DEFAULT_STAGGER,
    ...config,
  };

  return FadeIn.delay(baseDelay + index * staggerDelay)
    .duration(duration)
    .reduceMotion(ReduceMotion.System);
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use createStaggeredFadeIn instead
 */
export const createStaggeredFadeInUp = createStaggeredFadeIn;

/**
 * Creates stagger delays for manual animation sequencing
 * Returns array of delays for each item in sequence
 */
export function createStaggerDelays(
  count: number,
  config: Pick<StaggerConfig, 'baseDelay' | 'staggerDelay'> = {}
): number[] {
  const { baseDelay = 100, staggerDelay = 40 } = config;
  return Array.from({ length: count }, (_, i) => baseDelay + i * staggerDelay);
}

/**
 * Motion presets for common onboarding animations
 * Based on makeitanimated design patterns
 */
export const onboardingMotion = {
  // Stagger delays for common sequences
  stagger: {
    header: { baseDelay: 0, staggerDelay: 60 },
    content: { baseDelay: 100, staggerDelay: 40 },
    actions: { baseDelay: 300, staggerDelay: 50 },
    list: { baseDelay: 150, staggerDelay: 35 },
  },
  // Standard durations for onboarding steps
  durations: {
    quick: motion.dur.xs, // 120ms - micro interactions
    standard: motion.dur.sm, // 180ms - content enters
    emphasized: motion.dur.md, // 260ms - major transitions
  },
} as const;
