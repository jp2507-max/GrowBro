import { Link } from 'expo-router';
import * as React from 'react';
import {
  Platform,
  StyleSheet,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { DifficultyBadge } from '@/components/strains/difficulty-badge';
import { FavoriteButtonConnected } from '@/components/strains/favorite-button-connected';
import { FavoriteButtonDumb } from '@/components/strains/favorite-button-dumb';
import { RaceBadge } from '@/components/strains/race-badge';
import { THCBadge } from '@/components/strains/thc-badge';
import { Image, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { strainImageTag } from '@/lib/animations';
import { haptics } from '@/lib/haptics';
import { formatStrainCardLabel } from '@/lib/strains/accessibility';
import { getListImageProps } from '@/lib/strains/image-optimization';
import { useDynamicType } from '@/lib/strains/use-dynamic-type';
import type { Strain } from '@/types/strains';

const glassStyles = StyleSheet.create({
  favoriteButton: {
    borderRadius: 999,
    overflow: 'hidden',
  } as ViewStyle,
  overlayBadges: {
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,
});

type BaseProps = {
  strain: Strain;
  testID?: string;
  enableSharedTransition?: boolean;
  onStartNavigation?: (strainId: string) => void;
};

type ConnectedFavoriteProps = BaseProps & {
  isFavorite?: never;
  onToggleFavorite?: never;
};

type DumbFavoriteProps = BaseProps & {
  /** Renders a "dumb" favorite button instead of the connected one */
  isFavorite: boolean;
  /** Handler for toggling favorite state */
  onToggleFavorite: () => void;
};

type Props = ConnectedFavoriteProps | DumbFavoriteProps;

// Extracted component for badges
const StrainBadges = React.memo<{ strain: Strain }>(({ strain }) => (
  <View className="flex-row gap-1.5">
    <RaceBadge race={strain.race} />
    {strain.thc_display && <THCBadge thc={strain.thc_display} />}
    <DifficultyBadge difficulty={strain.grow.difficulty} />
  </View>
));
StrainBadges.displayName = 'StrainBadges';

type StrainCardOverlayProps = {
  isDark: boolean;
  style: ViewStyle;
  children: React.ReactNode;
};

const StrainCardOverlay = React.memo<StrainCardOverlayProps>(
  ({ isDark, style, children }) => {
    return (
      <View
        style={[
          style,
          isDark ? styles.overlayFallbackDark : styles.overlayFallbackLight,
        ]}
      >
        {children}
      </View>
    );
  }
);
StrainCardOverlay.displayName = 'StrainCardOverlay';

// Extracted component for card content
const StrainCardContent = React.memo<{
  strain: Strain;
  scaledSizes: ReturnType<typeof useDynamicType>['scaledSizes'];
  isLargeTextMode: boolean;
}>(({ strain, scaledSizes, isLargeTextMode }) => (
  <View className="gap-1 px-4 pb-4 pt-3">
    <Text
      className="font-bold text-charcoal-900 dark:text-neutral-100"
      style={{ fontSize: scaledSizes.xl }}
      numberOfLines={isLargeTextMode ? 3 : 1}
      allowFontScaling={true}
      maxFontSizeMultiplier={1.5}
    >
      {strain.name}
    </Text>
    {strain.description?.[0] && (
      <Text
        numberOfLines={2}
        className="leading-tight text-neutral-600 dark:text-neutral-400"
        style={{ fontSize: scaledSizes.sm }}
        allowFontScaling={true}
        maxFontSizeMultiplier={1.5}
      >
        {strain.description[0]}
      </Text>
    )}
  </View>
));
StrainCardContent.displayName = 'StrainCardContent';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedImage = Animated.createAnimatedComponent(Image);

// Extracted component for image section with overlays
type StrainCardImageSectionProps = {
  strain: Strain;
  enableSharedTransition: boolean;
  imageProps: ReturnType<typeof getListImageProps>;
  isDark: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

const StrainCardImageSection = React.memo<StrainCardImageSectionProps>(
  ({
    strain,
    enableSharedTransition,
    imageProps,
    isDark,
    isFavorite,
    onToggleFavorite,
  }) => (
    <View className="relative h-52 w-full bg-white">
      <AnimatedImage
        className="size-full"
        contentFit="cover"
        sharedTransitionTag={
          enableSharedTransition ? strainImageTag(strain.slug) : undefined
        }
        {...imageProps}
      />

      {/* Favorite Button */}
      <View className="absolute right-3 top-3">
        <StrainCardOverlay isDark={isDark} style={glassStyles.favoriteButton}>
          <View className="p-1.5">
            {isFavorite !== undefined && onToggleFavorite ? (
              <FavoriteButtonDumb
                isFavorite={isFavorite}
                onToggle={onToggleFavorite}
                testID={`favorite-btn-${strain.id}`}
              />
            ) : (
              <FavoriteButtonConnected
                strainId={strain.id}
                strain={strain}
                testID={`favorite-btn-${strain.id}`}
              />
            )}
          </View>
        </StrainCardOverlay>
      </View>

      {/* Overlay Badges */}
      <View className="absolute bottom-3 left-3 right-12">
        <StrainCardOverlay isDark={isDark} style={glassStyles.overlayBadges}>
          <View className="overflow-hidden rounded-xl px-2 py-1.5">
            <StrainBadges strain={strain} />
          </View>
        </StrainCardOverlay>
      </View>
    </View>
  )
);
StrainCardImageSection.displayName = 'StrainCardImageSection';

export const StrainCard = React.memo<Props>(
  ({
    strain,
    testID,
    enableSharedTransition = true,
    onStartNavigation,
    isFavorite,
    onToggleFavorite,
  }) => {
    const { scaledSizes, isLargeTextMode } = useDynamicType();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    React.useEffect(() => {
      scale.value = 1;
    }, [strain.id, scale]);

    const onPressIn = React.useCallback(() => {
      haptics.selection();
      onStartNavigation?.(strain.id);
      scale.value = withSpring(0.97, {
        damping: 10,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      });
    }, [onStartNavigation, scale, strain.id]);

    const onPressOut = React.useCallback(() => {
      scale.value = withSpring(1, {
        damping: 10,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      });
    }, [scale]);

    const accessibilityLabel = React.useMemo(
      () =>
        formatStrainCardLabel({
          name: strain.name,
          race: strain.race,
          thc_display: strain.thc_display,
          difficulty: strain.grow.difficulty,
        }),
      [strain.name, strain.race, strain.thc_display, strain.grow.difficulty]
    );

    const imageProps = React.useMemo(
      () => getListImageProps(strain.id, strain.imageUrl),
      [strain.id, strain.imageUrl]
    );

    return (
      <Link href={`/strains/${strain.slug}`} asChild>
        <AnimatedPressable
          accessibilityHint={translate(
            'accessibility.strains.open_detail_hint'
          )}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="link"
          testID={testID}
          className="mb-5 px-4"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={animatedStyle}
        >
          <View className="rounded-3xl" style={styles.cardShadow}>
            <View
              className="overflow-hidden rounded-3xl bg-white dark:bg-charcoal-900"
              style={styles.cardInner}
            >
              <StrainCardImageSection
                strain={strain}
                enableSharedTransition={enableSharedTransition}
                imageProps={imageProps}
                isDark={isDark}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />

              <StrainCardContent
                strain={strain}
                scaledSizes={scaledSizes}
                isLargeTextMode={isLargeTextMode}
              />
            </View>
          </View>
        </AnimatedPressable>
      </Link>
    );
  }
);

StrainCard.displayName = 'StrainCard';

const styles = StyleSheet.create({
  overlayFallbackDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  overlayFallbackLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardInner: {
    // @ts-ignore - borderCurve is iOS-only
    borderCurve: 'continuous',
  },
});
