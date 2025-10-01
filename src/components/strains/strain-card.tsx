import { Link } from 'expo-router';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { DifficultyBadge } from '@/components/strains/difficulty-badge';
import { RaceBadge } from '@/components/strains/race-badge';
import { THCBadge } from '@/components/strains/thc-badge';
import { Image, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
  testID?: string;
  itemY?: any; // Optional for future scroll animations
};

export const StrainCard = React.memo<Props>(({ strain, testID }) => {
  const accessibilityLabel = React.useMemo(() => {
    const raceText = translate(`strains.race.${strain.race}`);
    const thcText = strain.thc_display
      ? translate('strains.thc', { value: strain.thc_display })
      : '';
    const difficultyText = translate(
      `strains.difficulty.${strain.grow.difficulty}`
    );
    return `${strain.name}. ${raceText}. ${thcText}. ${difficultyText}. ${translate('accessibility.strains.open_detail_hint')}`;
  }, [strain]);

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
          {/* Image Container */}
          <View className="relative">
            <Image
              className="h-48 w-full"
              contentFit="cover"
              placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
              source={{ uri: strain.imageUrl }}
            />
          </View>

          {/* Content Container */}
          <View className="gap-2 p-4">
            {/* Badges */}
            <View className="flex-row flex-wrap gap-1.5">
              <RaceBadge race={strain.race} />
              {strain.thc_display && <THCBadge thc={strain.thc_display} />}
              <DifficultyBadge difficulty={strain.grow.difficulty} />
            </View>

            {/* Strain Name */}
            <Text
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
              numberOfLines={2}
            >
              {strain.name}
            </Text>

            {/* Description Preview */}
            {strain.description?.[0] && (
              <Text
                numberOfLines={2}
                className="text-sm leading-snug text-neutral-600 dark:text-neutral-400"
              >
                {strain.description[0]}
              </Text>
            )}
          </View>
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
