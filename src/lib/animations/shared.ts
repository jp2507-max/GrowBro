import {
  ReduceMotion,
  // @ts-ignore SharedTransition is exported in runtime but types might be missing in this version
  SharedTransition,
  withSpring,
} from 'react-native-reanimated';

/** Shared animation helpers used across the application. */

export const strainImageTag = (slug: string): string => `strain.image.${slug}`;

export const communityPostHeroTag = (postId: string): string =>
  `community.post.${postId}.hero`;

type SharedTransitionValues = {
  targetHeight: number;
  targetWidth: number;
  targetOriginX: number;
  targetOriginY: number;
};

export const sharedTransitionStyle = SharedTransition.custom(
  (values: SharedTransitionValues) => {
    'worklet';
    return {
      height: withSpring(values.targetHeight),
      width: withSpring(values.targetWidth),
      originX: withSpring(values.targetOriginX),
      originY: withSpring(values.targetOriginY),
    };
  }
).reduceMotion(ReduceMotion.System);
