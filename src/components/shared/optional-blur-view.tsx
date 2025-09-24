/* eslint-disable simple-import-sort/imports */
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

type BlurProps = {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | undefined;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export function OptionalBlurView({
  intensity = 0,
  tint = 'dark',
  style,
  testID,
  pointerEvents,
}: BlurProps) {
  const [Blur, setBlur] = React.useState<React.ComponentType<any> | null>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const moduleName = 'expo-blur';
    // Dynamic import to avoid bundling/type resolution issues if expo-blur is not installed yet
    import(moduleName)
      .then((mod: any) => setBlur(() => mod.BlurView))
      .catch(() => setBlur(null));
  }, []);

  if (Platform.OS !== 'ios' || !Blur) return null;

  return (
    <Blur
      style={style ?? (StyleSheet.absoluteFill as any)}
      tint={tint}
      intensity={intensity}
      testID={testID}
      pointerEvents={pointerEvents}
    />
  );
}

export const AnimatedOptionalBlurView = Animated.createAnimatedComponent(
  // Use a functional component wrapper so Animated can attach animatedProps cleanly
  (props: any) => <OptionalBlurView {...props} />
);
