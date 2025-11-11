import type { WithSpringConfig } from 'react-native-reanimated';

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
