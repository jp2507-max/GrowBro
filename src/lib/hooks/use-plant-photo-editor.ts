import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useUpdatePlant } from '@/api/plants';
import type { PlantPhotoInfo } from '@/components/plants/plant-form';
import { haptics } from '@/lib/haptics';

type UsePlantPhotoEditorOptions = {
  plantId: string | null;
};

type PlantPhotoEditorResult = {
  photoInfo: PlantPhotoInfo | null;
  handlePhotoInfo: (info: PlantPhotoInfo) => void;
  handleEditPhoto: () => void;
};

type PlantPhotoEditorActionParams = {
  photoInfo: PlantPhotoInfo;
  plantId: string;
  updatePlantPhoto: ReturnType<typeof useUpdatePlant>['mutateAsync'];
  queryClient: ReturnType<typeof useQueryClient>;
  t: ReturnType<typeof useTranslation>['t'];
};

/**
 * Shared logic for processing and saving a photo after capture/selection:
 * - Stores photo locally
 * - Updates form state
 * - Saves to database
 * - Invalidates queries
 * - Shows success/error messages
 */
async function processAndSavePhoto(
  uri: string,
  params: PlantPhotoEditorActionParams
): Promise<void> {
  const { photoInfo, plantId, updatePlantPhoto, queryClient, t } = params;
  const { storePlantPhotoLocally } = await import(
    '@/lib/media/plant-photo-storage'
  );
  const storeResult = await storePlantPhotoLocally(uri);
  // Update form state
  photoInfo.onPhotoCaptured(storeResult);
  // Auto-save to database
  try {
    await updatePlantPhoto({
      id: plantId,
      imageUrl: storeResult.localUri,
    });
    await queryClient.invalidateQueries({
      queryKey: ['plant', plantId],
    });
    showMessage({
      message: t('plants.form.photo_saved'),
      type: 'success',
    });
  } catch (saveError) {
    console.error('[PlantPhotoEditor] Photo save failed:', saveError);
    showMessage({
      message: t('plants.form.photo_save_error'),
      type: 'danger',
    });
  }
}

async function capturePhoto(
  params: PlantPhotoEditorActionParams
): Promise<void> {
  const { t } = params;
  try {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showMessage({
        message: t('harvest.photo.errors.camera_permission_denied'),
        type: 'danger',
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processAndSavePhoto(result.assets[0].uri, params);
    }
  } catch (error) {
    console.error('[PlantPhotoEditor] Photo capture failed:', error);
    showMessage({
      message: t('harvest.photo.errors.capture_failed'),
      description:
        error instanceof Error
          ? error.message
          : t('harvest.photo.errors.unknown_error'),
      type: 'danger',
    });
    throw error;
  }
}

async function pickPhotoFromLibrary(
  params: PlantPhotoEditorActionParams
): Promise<void> {
  const { t } = params;
  try {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processAndSavePhoto(result.assets[0].uri, params);
    }
  } catch (error) {
    console.error('[PlantPhotoEditor] Photo pick failed:', error);
    showMessage({
      message: t('harvest.photo.errors.select_failed'),
      description:
        error instanceof Error
          ? error.message
          : t('harvest.photo.errors.unknown_error'),
      type: 'danger',
    });
    throw error;
  }
}

/**
 * Custom hook to manage plant photo editing lifecycle:
 * - Stores photoInfo callback from PlantForm
 * - Shows action sheet for camera/library selection
 * - Handles image capture, storage, and auto-save
 */
export function usePlantPhotoEditor({
  plantId,
}: UsePlantPhotoEditorOptions): PlantPhotoEditorResult {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updatePlantPhoto } = useUpdatePlant();

  const [photoInfo, setPhotoInfo] = React.useState<PlantPhotoInfo | null>(null);

  const handlePhotoInfo = React.useCallback((info: PlantPhotoInfo) => {
    setPhotoInfo(info);
  }, []);

  const handleEditPhoto = React.useCallback(() => {
    if (!photoInfo || !plantId) return;
    haptics.selection();
    Alert.alert(
      t('harvest.photo.alerts.photo_options_title'),
      t('harvest.photo.choose_source'),
      [
        {
          text: t('harvest.photo.actions.take_photo'),
          onPress: () =>
            capturePhoto({
              photoInfo,
              plantId,
              updatePlantPhoto,
              queryClient,
              t,
            }),
        },
        {
          text: t('harvest.photo.actions.choose_from_library'),
          onPress: () =>
            pickPhotoFromLibrary({
              photoInfo,
              plantId,
              updatePlantPhoto,
              queryClient,
              t,
            }),
        },
        { text: t('harvest.photo.cancel'), style: 'cancel' },
      ]
    );
  }, [photoInfo, plantId, t, updatePlantPhoto, queryClient]);

  return { photoInfo, handlePhotoInfo, handleEditPhoto };
}
