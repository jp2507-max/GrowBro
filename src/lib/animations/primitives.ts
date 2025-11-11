import type { ColorValue } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Reanimated from 'react-native-reanimated';

import { SPRING } from './constants';

type WithSpringConfig = Parameters<typeof Reanimated.withSpring>[1];

export type InterpolateOptions = {
  clamp?: boolean;
};

export type SpringifyOptions = {
  spring?: boolean;
  springConfig?: WithSpringConfig;
  reduceMotion?: boolean;
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
  if (!spring || opts?.reduceMotion) return value;
  return Reanimated.withSpring(value, opts?.springConfig ?? SPRING);
}

export function indexInterpolate(params: InterpolateParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, options } = params;
  return Reanimated.interpolate(
    activeIndex.value,
    inputRange,
    outputRange,
    options?.clamp === false
      ? Reanimated.Extrapolation.EXTEND
      : Reanimated.Extrapolation.CLAMP
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
  const v = Reanimated.interpolate(
    activeIndex.value,
    [centerIndex - window, centerIndex, centerIndex + window],
    [0, 1, 0],
    Reanimated.Extrapolation.CLAMP
  );
  return applySpring(v, opts);
}

export function hsvInterpolateColor(
  activeIndex: SharedValue<number>,
  inputRange: readonly number[],
  colors: readonly (ColorValue | number)[]
): number {
  'worklet';
  return Reanimated.interpolateColor(
    activeIndex.value,
    inputRange,
    colors,
    'HSV'
  );
}

export function ctaGateToLastIndex(
  activeIndex: SharedValue<number>,
  lastIndex: number
): { opacity: number; enabled: boolean } {
  'worklet';
  const before = Math.max(lastIndex - 1, 0);
  const opacity = Reanimated.interpolate(
    activeIndex.value,
    [before, lastIndex],
    [0, 1],
    Reanimated.Extrapolation.CLAMP
  );
  // Enabled once the active index is at or beyond the last slide threshold
  const enabled = activeIndex.value >= lastIndex - 0.001;
  return { opacity, enabled };
}
