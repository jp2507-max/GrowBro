import type Reanimated from 'react-native-reanimated';

type WithSpringConfig = Parameters<typeof Reanimated.withSpring>[1];

// Baseline spring config inspired by the reference onboarding
export const SPRING: WithSpringConfig = {
  mass: 1,
  stiffness: 240,
  damping: 20,
};

export type SpringOptions = {
  enabled?: boolean;
  config?: WithSpringConfig;
  reduceMotionDisabled?: boolean; // if true, bypass animation and return target values
};
