/* eslint-disable simple-import-sort/imports */
import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { BlurTint } from 'expo-blur';

type BlurProps = {
  intensity?: number;
  tint?: BlurTint | undefined;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  // Reanimated injects extra props; allow them through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type ExpoBlurModule = {
  // Use any here to avoid incompatibilities between expo-blur's extended props
  // and the narrow subset we forward (intensity/tint/style/pointerEvents).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BlurView: React.ComponentType<any>;
};

const FallbackBlur = React.forwardRef<RNView, BlurProps>(
  ({ style, testID, pointerEvents, ...rest }, ref) => (
    <RNView
      ref={ref}
      style={style ?? StyleSheet.absoluteFill}
      testID={testID}
      pointerEvents={pointerEvents}
      {...rest}
    />
  )
);

function OptionalBlurViewBase(
  {
    intensity = 0,
    tint = 'dark',
    style,
    testID,
    pointerEvents,
    ...rest
  }: BlurProps,
  ref: React.Ref<RNView>
) {
  const [BlurComponent, setBlurComponent] = React.useState<
    React.ComponentType<BlurProps>
  >(() => FallbackBlur);

  React.useEffect(() => {
    let isMounted = true;
    import('expo-blur')
      .then((mod: ExpoBlurModule) => {
        if (isMounted && mod.BlurView) {
          setBlurComponent(() => mod.BlurView);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBlurComponent(() => FallbackBlur);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const ResolvedBlur = BlurComponent;

  return (
    <ResolvedBlur
      ref={ref}
      style={style ?? StyleSheet.absoluteFill}
      tint={tint}
      intensity={intensity}
      testID={testID}
      pointerEvents={pointerEvents}
      {...rest}
    />
  );
}

export const OptionalBlurView = React.forwardRef(OptionalBlurViewBase);

export const AnimatedOptionalBlurView =
  Animated.createAnimatedComponent(OptionalBlurView);
