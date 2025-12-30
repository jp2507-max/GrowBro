import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api/plants/types';
import { Image, Pressable, Text, View } from '@/components/ui';
import { ArrowLeft } from '@/components/ui/icons';
import { usePlantPhotoSync } from '@/lib/plants/plant-photo-sync';

type PlantDetailHeaderProps = {
  plant: Plant;
  onBack: () => void;
  /** Optional callback for editing the plant photo (tap on image area) */
  onEditPhoto?: () => void;
};

/**
 * Premium Organic hero header for the plant detail screen.
 * Full-width image with gradient overlay, plant name, and strain info.
 * Optionally supports photo editing via onEditPhoto callback.
 */
export function PlantDetailHeader({
  plant,
  onBack,
  onEditPhoto,
}: PlantDetailHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Auto-sync plant photo from remote if missing locally
  const { resolvedLocalUri } = usePlantPhotoSync(plant);
  const imageSource = resolvedLocalUri
    ? { uri: resolvedLocalUri }
    : require('../../../assets/icon.png');

  return (
    <View className="relative h-80 w-full bg-neutral-100 dark:bg-neutral-800">
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

      {/* Edit Photo Button - shown when onEditPhoto is provided */}
      {onEditPhoto && (
        <View className="absolute right-4 z-20" style={{ top: insets.top + 8 }}>
          <Pressable
            onPress={onEditPhoto}
            className="size-10 items-center justify-center rounded-full bg-black/30 active:bg-black/50"
            accessibilityRole="button"
            accessibilityLabel={t('plants.form.edit_photo')}
            accessibilityHint={t('harvest.photo.choose_source')}
            testID="plant-edit-photo-button"
          >
            <Text className="text-lg">✏️</Text>
          </Pressable>
        </View>
      )}

      {/* Back Button - floating on image */}
      <Pressable
        onPress={onBack}
        className="absolute left-4 z-20 size-10 items-center justify-center rounded-full bg-black/30 active:bg-black/50"
        style={{ top: insets.top + 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.common.go_back')}
        accessibilityHint={t('accessibility.common.return_to_previous')}
        testID="plant-detail-back-button"
      >
        <ArrowLeft color="#fff" width={22} height={22} />
      </Pressable>

      {/* Gradient Overlay with Plant Info */}
      <View className="absolute inset-x-0 bottom-0">
        <LinearGradient
          colors={[
            'transparent',
            'rgba(2, 44, 34, 0.7)',
            'rgba(2, 44, 34, 0.9)',
          ]}
          locations={[0, 0.4, 1]}
          className="w-full"
        >
          <View className="px-5 pb-10 pt-16">
            {/* Strain Label (above name) */}
            {plant.strain ? (
              <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-white/70">
                {plant.strain}
              </Text>
            ) : null}

            {/* Plant Name */}
            <Text className="text-4xl font-extrabold text-white">
              {plant.name}
            </Text>

            {/* Stage Badge Row */}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {plant.stage ? (
                <View className="rounded-full bg-terracotta-500/80 px-3 py-1">
                  <Text className="text-sm font-medium text-white">
                    {t(`plants.form.stage.${plant.stage}`)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}
