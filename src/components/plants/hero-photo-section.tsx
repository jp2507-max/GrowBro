import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Image, Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { captureAndStore } from '@/lib/media/photo-storage-service';
import type { PhotoVariants } from '@/types/photo-storage';

type HeroPhotoSectionProps = {
  imageUrl?: string;
  onPhotoCaptured: (photo: PhotoVariants) => void;
  disabled?: boolean;
  testID?: string;
};

async function capturePhoto(
  source: 'camera' | 'library',
  onPhotoCaptured: (photo: PhotoVariants) => void,
  t: (key: string) => string
): Promise<void> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t('harvest.photo.errors.camera_permission_denied'));
    }
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

  if (!result.canceled && result.assets[0]?.uri) {
    const variant = await captureAndStore(result.assets[0].uri);
    onPhotoCaptured(variant);
  }
}

export function HeroPhotoSection({
  imageUrl,
  onPhotoCaptured,
  disabled,
  testID = 'hero-photo',
}: HeroPhotoSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleCapture = React.useCallback(
    async (source: 'camera' | 'library') => {
      try {
        setIsProcessing(true);
        await capturePhoto(source, onPhotoCaptured, t);
      } catch (error) {
        console.error('[HeroPhotoSection] Capture failed:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [onPhotoCaptured, t]
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
            {isProcessing ? (
              <View className="size-full items-center justify-center">
                <ActivityIndicator size="large" />
                <Text className="mt-2 text-sm text-neutral-500">
                  {t('harvest.photo.processing_photo')}
                </Text>
              </View>
            ) : imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                className="size-full"
                contentFit="cover"
              />
            ) : (
              <View className="size-full items-center justify-center">
                <Text className="text-5xl">🌱</Text>
                <Text className="mt-2 text-sm text-neutral-500">
                  {t('plants.form.add_photo')}
                </Text>
              </View>
            )}
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
