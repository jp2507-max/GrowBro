import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { useUpdatePlant } from '@/api/plants/use-update-plant';
import { Image, Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { PlantPhotoStoreResult } from '@/lib/media/plant-photo-storage';
import { storePlantPhotoLocally } from '@/lib/media/plant-photo-storage';

type HeroPhotoSectionProps = {
  imageUrl?: string;
  onPhotoCaptured: (photo: PlantPhotoStoreResult) => void;
  disabled?: boolean;
  testID?: string;
  plantId?: string;
};

async function pickImage(source: 'camera' | 'library') {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 1,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
        });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

function PhotoContent({
  imageUrl,
  isProcessing,
  addPhotoText,
  processingText,
}: {
  imageUrl?: string;
  isProcessing: boolean;
  addPhotoText: string;
  processingText: string;
}) {
  if (isProcessing) {
    return (
      <View className="size-full items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-2 text-sm text-neutral-500">{processingText}</Text>
      </View>
    );
  }
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className="size-full"
        contentFit="cover"
      />
    );
  }
  return (
    <View className="size-full items-center justify-center">
      <Text className="text-5xl">🌱</Text>
      <Text className="mt-2 text-sm text-neutral-500">{addPhotoText}</Text>
    </View>
  );
}

export function HeroPhotoSection({
  imageUrl,
  onPhotoCaptured,
  disabled,
  testID = 'hero-photo',
  plantId,
}: HeroPhotoSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { mutateAsync: updatePlant } = useUpdatePlant();

  const handleCapture = React.useCallback(
    async (source: 'camera' | 'library') => {
      try {
        setIsProcessing(true);
        const uri = await pickImage(source);
        if (!uri) {
          if (source === 'camera')
            showMessage({
              message: t('harvest.photo.errors.camera_permission_denied'),
              type: 'danger',
            });
          return;
        }
        const storeResult = await storePlantPhotoLocally(uri);
        onPhotoCaptured(storeResult);
        if (plantId) {
          try {
            await updatePlant({ id: plantId, imageUrl: storeResult.localUri });
            showMessage({
              message: t('plants.form.photo_saved'),
              type: 'success',
            });
          } catch {
            showMessage({
              message: t('plants.form.photo_save_error'),
              type: 'danger',
            });
          }
        }
      } catch (error) {
        console.error('[HeroPhotoSection] Capture failed:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [onPhotoCaptured, t, plantId, updatePlant]
  );

  const handlePress = React.useCallback(() => {
    haptics.selection();
    Alert.alert(
      t('harvest.photo.alerts.photo_options_title'),
      t('harvest.photo.choose_source'),
      [
        {
          text: t('harvest.photo.actions.take_photo'),
          onPress: () => handleCapture('camera'),
        },
        {
          text: t('harvest.photo.actions.choose_from_library'),
          onPress: () => handleCapture('library'),
        },
        { text: t('harvest.photo.cancel'), style: 'cancel' },
      ]
    );
  }, [t, handleCapture]);

  const label = imageUrl
    ? t('plants.form.edit_photo')
    : t('plants.form.add_photo');

  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="items-center py-6"
      testID={testID}
    >
      <Pressable
        onPress={handlePress}
        disabled={disabled || isProcessing}
        className="active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('harvest.photo.choose_source')}
      >
        <View className="relative">
          <View className="size-44 overflow-hidden rounded-3xl border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
            <PhotoContent
              imageUrl={imageUrl}
              isProcessing={isProcessing}
              addPhotoText={t('plants.form.add_photo')}
              processingText={t('harvest.photo.processing_photo')}
            />
          </View>
          {!isProcessing && (
            <View className="absolute -bottom-2 -right-2 size-10 items-center justify-center rounded-full border-2 border-white bg-primary-600 dark:border-charcoal-950">
              <Text className="text-lg">✏️</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
