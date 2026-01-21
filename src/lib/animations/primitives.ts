import type { ColorValue } from 'react-native';
import {
  interpolate,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRING } from './constants';

type WithSpringConfig = Parameters<typeof withSpring>[1];

export type InterpolateOptions = {
  clamp?: boolean;
};

export type SpringifyOptions = {
  spring?: boolean;
  springConfig?: WithSpringConfig;
  skipAnimation?: boolean;
};

type InterpolateParams = {
  activeIndex: SharedValue<number>;
  inputRange: readonly number[];
  outputRange: readonly number[];
  options?: InterpolateOptions;
};

type IndexDrivenParams = {
  activeIndex: SharedValue<number>;
  inputRange: readonly number[];
  outputRange: readonly number[];
  opts?: SpringifyOptions & InterpolateOptions;
};

type CrossfadeParams = {
  activeIndex: SharedValue<number>;
  centerIndex: number;
  window?: number;
  opts?: SpringifyOptions;
};

function applySpring(value: number, opts?: SpringifyOptions): number {
  'worklet';
  const spring = opts?.spring ?? true;
  if (!spring || opts?.skipAnimation) return value;
  const springConfig = opts?.springConfig ?? SPRING;
  if (springConfig.reduceMotion != null) {
    return withSpring(value, springConfig);
  }
  return withSpring(value, {
    ...springConfig,
    reduceMotion: ReduceMotion.System,
  });
}

export function indexInterpolate(params: InterpolateParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, options } = params;
  return interpolate(
    activeIndex.value,
    inputRange,
    outputRange,
    options?.clamp === false ? 'extend' : 'clamp'
  );
}

export function indexDrivenTranslateX(params: IndexDrivenParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, opts } = params;
  const v = indexInterpolate({
    activeIndex,
    inputRange,
    outputRange,
    options: opts,
  });
  return applySpring(v, opts);
}

export function indexDrivenRotate(params: IndexDrivenParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, opts } = params;
  const v = indexInterpolate({
    activeIndex,
    inputRange,
    outputRange,
    options: opts,
  });
  return applySpring(v, opts);
}

export function indexDrivenScale(params: IndexDrivenParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, opts } = params;
  const v = indexInterpolate({
    activeIndex,
    inputRange,
    outputRange,
    options: opts,
  });
  return applySpring(v, opts);
}

export function crossfadeAroundIndex(params: CrossfadeParams): number {
  'worklet';
  const { activeIndex, centerIndex, window = 0.5, opts } = params;
  if (window <= 0) {
    const isCentered = Math.abs(activeIndex.value - centerIndex) < 1e-3;
    return applySpring(isCentered ? 1 : 0, opts);
  }

  const distance = Math.abs(activeIndex.value - centerIndex);
  const v = distance >= window ? 0 : 1 - distance / window;
  return applySpring(v, opts);
}

export function hsvInterpolateColor(
  activeIndex: SharedValue<number>,
  inputRange: readonly number[],
  colors: readonly (ColorValue | number)[]
): number {
  'worklet';
  return interpolateColor(activeIndex.value, inputRange, colors, 'HSV');
}

export function ctaGateToLastIndex(
  activeIndex: SharedValue<number>,
  lastIndex: number
): { opacity: number; enabled: boolean } {
  'worklet';
  const before = Math.max(lastIndex - 1, 0);
  const opacity = interpolate(
    activeIndex.value,
    [before, lastIndex],
    [0, 1],
    'clamp'
  );
  // Enabled once the active index is at or beyond the last slide threshold
  const enabled = activeIndex.value >= lastIndex - 0.001;
  return { opacity, enabled };
}
