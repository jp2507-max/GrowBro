import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, View } from '@/components/ui';

type StrainsGradientBackgroundProps = {
  children: React.ReactNode;
  /** Additional style for the container */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
};

/**
 * Premium dark gradient background for the strains discovery screen.
 * Uses a 3-stop gradient from dark forest green to deep black,
 * matching the Stitch luxury design aesthetic.
 *
 * Gradient stops:
 * - 0%: #181d14 (dark forest)
 * - 50%: #0d1f12 (mid forest)
 * - 100%: #050a04 (deep black)
 */
export function StrainsGradientBackground({
  children,
  style,
  testID = 'strains-gradient-background',
}: StrainsGradientBackgroundProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <LinearGradient
        colors={[colors.strains.dark, colors.strains.mid, colors.strains.deep]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
