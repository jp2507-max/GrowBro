import { Link } from 'expo-router';
import * as React from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { translate } from '@/lib';
import { strainImageTag } from '@/lib/animations';
import { haptics } from '@/lib/haptics';
import { getDetailImageProps } from '@/lib/strains/image-optimization';
import type { Strain } from '@/types/strains';

type StrainHeroCardProps = {
  strain: Strain;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedImage = Animated.createAnimatedComponent(Image);

// Extracted: Hero Info Row
const HeroInfoRow = React.memo<{ thcDisplay?: string; raceLabel: string }>(
  ({ thcDisplay, raceLabel }) => (
    <View className="gap-1">
      {thcDisplay && (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-white/60">⚗️</Text>
          <Text className="text-sm font-medium text-white/90">
            {thcDisplay} THC
          </Text>
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <Text className="text-sm text-white/60">🌿</Text>
        <Text className="text-sm font-medium text-white/90">{raceLabel}</Text>
      </View>
    </View>
  )
);
HeroInfoRow.displayName = 'HeroInfoRow';

// Extracted: Hero Glass Panel
type HeroGlassPanelProps = {
  strain: Strain;
  raceLabel: string;
  isDark: boolean;
};

const HeroGlassPanel = React.memo<HeroGlassPanelProps>(
  ({ strain, raceLabel, isDark }) => (
    <View
      style={[
        styles.glassPanel,
        isDark ? styles.glassPanelDark : styles.glassPanelLight,
      ]}
      className="rounded-xl border-t border-white/20 p-4"
    >
      {/* Top Row: Label + Badge */}
      <View className="mb-2 flex-row items-start justify-between">
        <Text
          style={styles.labelText}
          className="text-xs font-bold uppercase tracking-widest"
        >
          {translate('strains.hero.featured_label')}
        </Text>
        <View style={styles.topRatedBadge} className="rounded px-2 py-0.5">
          <Text style={styles.labelText} className="text-[10px] font-bold">
            {translate('strains.hero.top_rated')}
          </Text>
        </View>
      </View>

      {/* Strain Name */}
      <Text
        className="mb-3 text-2xl font-bold leading-tight text-white"
        numberOfLines={2}
      >
        {strain.name}
      </Text>

      {/* Bottom Row: Info + CTA */}
      <View className="flex-row items-end justify-between">
        <HeroInfoRow thcDisplay={strain.thc_display} raceLabel={raceLabel} />
        <View style={styles.ctaButton} className="rounded-lg px-4 py-2">
          <Text className="text-sm font-bold text-black">
            {translate('strains.hero.view_details')}
          </Text>
        </View>
      </View>
    </View>
  )
);
HeroGlassPanel.displayName = 'HeroGlassPanel';

/**
 * Hero card for "Strain of the Month" feature.
 */
export const StrainHeroCard = React.memo<StrainHeroCardProps>(
  ({ strain, testID = 'strain-hero-card' }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.get() }],
    }));

    const onPressIn = React.useCallback(() => {
      haptics.selection();
      scale.set(
        withSpring(0.98, {
          damping: 10,
          stiffness: 300,
          reduceMotion: ReduceMotion.System,
        })
      );
    }, [scale]);

    const onPressOut = React.useCallback(() => {
      scale.set(
        withSpring(1, {
          damping: 10,
          stiffness: 300,
          reduceMotion: ReduceMotion.System,
        })
      );
    }, [scale]);

    const imageProps = React.useMemo(
      () => getDetailImageProps(strain.id, strain.imageUrl),
      [strain.id, strain.imageUrl]
    );

    const raceLabel = React.useMemo(() => {
      const raceMap = {
        indica: 'Indica Dominant',
        sativa: 'Sativa Dominant',
        hybrid: 'Hybrid',
      };
      return raceMap[strain.race] || strain.race;
    }, [strain.race]);

    return (
      <Link href={`/strains/${strain.slug}`} asChild>
        <AnimatedPressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={translate('strains.hero.accessibility_label', {
            name: strain.name,
          })}
          accessibilityHint={translate(
            'accessibility.strains.open_detail_hint'
          )}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={animatedStyle}
          className="mx-5 overflow-hidden rounded-2xl"
        >
          <View style={styles.cardContainer}>
            <AnimatedImage
              className="absolute inset-0 size-full"
              contentFit="cover"
              sharedTransitionTag={strainImageTag(strain.slug)}
              {...imageProps}
            />
            <View style={styles.gradientOverlay} pointerEvents="none" />
            <View className="absolute inset-x-0 bottom-0 p-5">
              <HeroGlassPanel
                strain={strain}
                raceLabel={raceLabel}
                isDark={isDark}
              />
            </View>
          </View>
        </AnimatedPressable>
      </Link>
    );
  }
);
StrainHeroCard.displayName = 'StrainHeroCard';

const styles = StyleSheet.create({
  cardContainer: {
    aspectRatio: 4 / 5,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  gradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
  },
  glassPanel: { backdropFilter: 'blur(12px)' },
  glassPanelDark: { backgroundColor: 'rgba(20, 24, 17, 0.7)' },
  glassPanelLight: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  topRatedBadge: {
    backgroundColor: 'rgba(148, 250, 46, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(148, 250, 46, 0.2)',
  },
  ctaButton: { backgroundColor: colors.neon.lime },
  labelText: { color: colors.neon.lime },
});
