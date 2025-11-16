/* eslint-disable simple-import-sort/imports */
import React from 'react';
import { StyleSheet } from 'react-native';
import type { ViewStyle, RegisteredStyle } from 'react-native';
import Animated from 'react-native-reanimated';

type BlurProps = {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | undefined;
  style?: ViewStyle | ViewStyle[] | RegisteredStyle<ViewStyle>;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

type ExpoBlurModule = {
  BlurView: React.ComponentType<BlurProps>;
};

export function OptionalBlurView({
  intensity = 0,
  tint = 'dark',
  style,
  testID,
  pointerEvents,
}: BlurProps) {
  const [Blur, setBlur] = React.useState<React.ComponentType<BlurProps> | null>(
    null
  );
  React.useEffect(() => {
    const moduleName = 'expo-blur';
    // Dynamic import to avoid bundling/type resolution issues if expo-blur is not installed yet
    import(moduleName)
      .then((mod: ExpoBlurModule) => setBlur(() => mod.BlurView))
      .catch(() => setBlur(null));
  }, []);

  if (!Blur) return null;

  return (
    <Blur
      style={style ?? StyleSheet.absoluteFill}
      tint={tint}
      intensity={intensity}
      testID={testID}
      pointerEvents={pointerEvents}
    />
  );
}

const OptionalBlurViewWrapper = React.forwardRef<unknown, BlurProps>(
  (props, _ref) => <OptionalBlurView {...props} />
);

export const AnimatedOptionalBlurView = Animated.createAnimatedComponent(
  OptionalBlurViewWrapper
);
