import type {
  Extrapolation,
  interpolate,
  interpolateColor,
  SharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { SPRING } from './constants';

export type InterpolateOptions = {
  clamp?: boolean;
};

export type SpringifyOptions = {
  spring?: boolean;
  springConfig?: WithSpringConfig;
  reduceMotionDisabled?: boolean;
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
  if (!spring || opts?.reduceMotionDisabled) return value;
  return withSpring(value, opts?.springConfig ?? SPRING);
}

export function indexInterpolate(params: InterpolateParams): number {
  'worklet';
  const { activeIndex, inputRange, outputRange, options } = params;
  return interpolate(
    activeIndex.get(),
    inputRange,
    outputRange,
    options?.clamp === false ? Extrapolation.EXTEND : Extrapolation.CLAMP
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
  const v = interpolate(
    activeIndex.get(),
    [centerIndex - window, centerIndex, centerIndex + window],
    [0, 1, 0],
    Extrapolation.CLAMP
  );
  return applySpring(v, opts);
}

export function hsvInterpolateColor(
  activeIndex: SharedValue<number>,
  inputRange: readonly number[],
  colors: readonly (string | number)[]
): number {
  'worklet';
  return interpolateColor(activeIndex.get(), inputRange, colors as any, 'HSV');
}

export function ctaGateToLastIndex(
  activeIndex: SharedValue<number>,
  lastIndex: number
): { opacity: number; enabled: boolean } {
  'worklet';
  const before = Math.max(lastIndex - 1, 0);
  const opacity = interpolate(
    activeIndex.get(),
    [before, lastIndex],
    [0, 1],
    Extrapolation.CLAMP
  );
  // Enabled once the active index is at or beyond the last slide threshold
  const enabled = activeIndex.get() >= lastIndex - 0.001;
  return { opacity, enabled };
}
