import { Link } from 'expo-router';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { DifficultyBadge } from '@/components/strains/difficulty-badge';
import { RaceBadge } from '@/components/strains/race-badge';
import { THCBadge } from '@/components/strains/thc-badge';
import { Image, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { formatStrainCardLabel } from '@/lib/strains/accessibility';
import { getListImageProps } from '@/lib/strains/image-optimization';
import {
  useDynamicType,
  useResponsiveSpacing,
} from '@/lib/strains/use-dynamic-type';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
  testID?: string;
  itemY?: any; // Optional for future scroll animations
};

// Extracted component for badges
const StrainBadges = React.memo<{ strain: Strain; gap: number }>(
  ({ strain, gap }) => (
    <View className="flex-row flex-wrap" style={{ gap }}>
      <RaceBadge race={strain.race} />
      {strain.thc_display && <THCBadge thc={strain.thc_display} />}
      <DifficultyBadge difficulty={strain.grow.difficulty} />
    </View>
  )
);
StrainBadges.displayName = 'StrainBadges';

// Extracted component for card content
const StrainCardContent = React.memo<{
  strain: Strain;
  scaledSizes: any;
  spacing: any;
  isLargeTextMode: boolean;
}>(({ strain, scaledSizes, spacing, isLargeTextMode }) => (
  <View className="gap-2" style={{ padding: spacing.cardPadding }}>
    <StrainBadges strain={strain} gap={spacing.badgeGap} />
    <Text
      className="font-semibold text-neutral-900 dark:text-neutral-100"
      style={{ fontSize: scaledSizes.lg }}
      numberOfLines={isLargeTextMode ? 3 : 2}
      allowFontScaling={true}
      maxFontSizeMultiplier={2}
    >
      {strain.name}
    </Text>
    {strain.description?.[0] && (
      <Text
        numberOfLines={isLargeTextMode ? 3 : 2}
        className="leading-snug text-neutral-600 dark:text-neutral-400"
        style={{ fontSize: scaledSizes.sm }}
        allowFontScaling={true}
        maxFontSizeMultiplier={2}
      >
        {strain.description[0]}
      </Text>
    )}
  </View>
));
StrainCardContent.displayName = 'StrainCardContent';

export const StrainCard = React.memo<Props>(({ strain, testID }) => {
  const { scaledSizes, isLargeTextMode } = useDynamicType();
  const spacing = useResponsiveSpacing();

  const accessibilityLabel = React.useMemo(
    () =>
      formatStrainCardLabel({
        name: strain.name,
        race: strain.race,
        thc_display: strain.thc_display,
        difficulty: strain.grow.difficulty,
      }),
    [strain]
  );

  const imageProps = React.useMemo(
    () => getListImageProps(strain.id, strain.imageUrl),
    [strain.id, strain.imageUrl]
  );

  const imageHeight = isLargeTextMode ? 'h-56' : 'h-48';

  return (
    <Link href={`/strains/${strain.id}`} asChild>
      <Pressable
        accessibilityHint={translate('accessibility.strains.open_detail_hint')}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="link"
        testID={testID}
        className="px-4 py-2"
      >
        <View
          className="flex-1 overflow-hidden rounded-3xl border border-neutral-300/80 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          style={styles.card}
        >
          <View className="relative">
            <Image
              className={`${imageHeight} w-full`}
              contentFit="cover"
              {...imageProps}
            />
          </View>
          <StrainCardContent
            strain={strain}
            scaledSizes={scaledSizes}
            spacing={spacing}
            isLargeTextMode={isLargeTextMode}
          />
        </View>
      </Pressable>
    </Link>
  );
});

StrainCard.displayName = 'StrainCard';

const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
    // @ts-ignore - borderCurve is iOS-only
    borderCurve: 'continuous',
  },
});
