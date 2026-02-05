import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { Plant } from '@/api/plants/types';
import { Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Sun } from '@/components/ui/icons';
import { usePlantPhotoSync } from '@/lib/plants/plant-photo-sync';
import {
  getProductStageLabelKey,
  toProductStage,
} from '@/lib/plants/product-stage';

type PlantDetailHeaderProps = {
  plant: Plant;
  /** Optional callback for editing the plant photo (tap on image area) */
  onEditPhoto?: () => void;
};

const styles = StyleSheet.create({
  stageBadgeShadow: {
    shadowColor: colors.terracotta[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

/**
 * Premium Organic hero header for the plant detail screen.
 * Full-width image with gradient overlay, stage badge, and strain/name info.
 * Back button is handled by parent sticky header.
 */
export function PlantDetailHeader({
  plant,
  onEditPhoto,
}: PlantDetailHeaderProps): React.ReactElement {
  const { t } = useTranslation();

  // Auto-sync plant photo from remote if missing locally
  const { resolvedLocalUri } = usePlantPhotoSync(plant);
  const imageSource = resolvedLocalUri
    ? { uri: resolvedLocalUri }
    : require('../../../assets/icon.png');

  // Get stage label
  const stageLabel = React.useMemo(() => {
    const productStage = toProductStage(plant.stage);
    if (!productStage) return null;
    return t(getProductStageLabelKey(productStage));
  }, [plant.stage, t]);

  // Display name: prefer strain, fallback to plant name
  const displayName = plant.strain || plant.name;

  return (
    <View className="relative w-full" style={{ aspectRatio: 4 / 3 }}>
      {/* Hero Image - tappable when onEditPhoto is provided */}
      <Pressable
        onPress={onEditPhoto}
        disabled={!onEditPhoto}
        className="size-full"
        accessibilityRole={onEditPhoto ? 'button' : 'image'}
        accessibilityLabel={
          onEditPhoto
            ? t('plants.form.edit_photo')
            : t('accessibility.plant_hero_image')
        }
        accessibilityHint={
          onEditPhoto ? t('harvest.photo.choose_source') : undefined
        }
        testID="plant-hero-image-pressable"
      >
        <Image
          source={imageSource}
          className="size-full"
          contentFit="cover"
          testID="plant-hero-image"
        />
      </Pressable>

      {/* Gradient Overlay with Plant Info */}
      <View className="absolute inset-x-0 bottom-0">
        <LinearGradient
          colors={[
            'transparent',
            `${colors.charcoal[950]}80`, // 50% opacity
            `${colors.charcoal[950]}CC`, // 80% opacity
            colors.charcoal[950], // 100% opacity
          ]}
          locations={[0, 0.3, 0.6, 1]}
          className="w-full"
        >
          <View className="gap-3 px-6 pb-6 pt-20">
            {/* Stage Badge - Glowing Orange Pill */}
            {stageLabel ? (
              <View
                className="flex-row items-center gap-2 self-start rounded-full border border-terracotta-500/50 bg-terracotta-500/20 px-3 py-1.5"
                style={styles.stageBadgeShadow}
              >
                <Sun color={colors.terracotta[400]} width={18} height={18} />
                <Text className="text-xs font-bold uppercase tracking-wider text-terracotta-400">
                  {stageLabel}
                </Text>
              </View>
            ) : null}

            {/* Strain/Plant Name - Large Display */}
            <Text className="text-4xl font-extrabold tracking-tight text-white">
              {displayName}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}
