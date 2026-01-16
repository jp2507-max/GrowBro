/**
 * Glass Card Component
 * Premium glassmorphism card with spring animation for onboarding
 */

import React, { type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { OptionalBlurView } from '@/components/shared/optional-blur-view';
import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

type GlassCardProps = {
  index: number;
  testID: string;
  icon: ReactNode;
  iconBg: string;
  titleKey: TxKeyPath;
  bodyKey: TxKeyPath;
};

const styles = StyleSheet.create({
  blurFallbackDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  blurFallbackLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

type GlassCardOverlayProps = {
  isDark: boolean;
  style: ViewStyle;
  children: React.ReactNode;
};

const GlassCardOverlay = React.memo<GlassCardOverlayProps>(
  ({ isDark, style, children }) => {
    if (Platform.OS !== 'ios') {
      return (
        <View
          style={[
            style,
            isDark ? styles.blurFallbackDark : styles.blurFallbackLight,
          ]}
        >
          {children}
        </View>
      );
    }

    return (
      <OptionalBlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={style}
      >
        {children}
      </OptionalBlurView>
    );
  }
);
GlassCardOverlay.displayName = 'GlassCardOverlay';

export function GlassCard({
  index,
  testID,
  icon,
  iconBg,
  titleKey,
  bodyKey,
}: GlassCardProps): React.ReactElement {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const staggerDelay = 200 + index * 100;

  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.delay(staggerDelay)
        .springify()
        .damping(14)
        .stiffness(120)
        .mass(0.8)
        .reduceMotion(ReduceMotion.System)}
      className="flex-row items-center rounded-2xl border border-white/20 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-charcoal-900/70"
    >
      <GlassCardOverlay isDark={isDark} style={styles.absoluteFill}>
        <View
          className={`mr-4 size-12 items-center justify-center rounded-xl ${iconBg}`}
        >
          {typeof icon === 'string' ? (
            <Text className="text-2xl">{icon}</Text>
          ) : (
            icon
          )}
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-charcoal-950 dark:text-white">
            {translate(titleKey)}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {translate(bodyKey)}
          </Text>
        </View>
      </GlassCardOverlay>
    </Animated.View>
  );
}
