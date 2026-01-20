import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { captureAndStore } from '@/lib/media/photo-storage-service';
import type { PhotoVariants } from '@/types/photo-storage';

class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

export type PhotoCaptureProps = {
  onPhotoCaptured?: (photoVariant: PhotoVariants) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  buttonTextKey?: string;
};

type PhotoCaptureState = {
  isProcessing: boolean;
  error: string | null;
};

async function captureFromCamera(
  t: (key: string) => string
): Promise<PhotoVariants> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(t('harvest.photo.errors.camera_permission_denied'));
  }

  haptics.selection();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled) {
    throw new CancellationError(t('harvest.photo.cancel'));
  }

  const photoUri = result.assets[0]?.uri;
  if (!photoUri) {
    throw new Error(t('harvest.photo.errors.no_uri'));
  }

  return captureAndStore(photoUri);
}

async function selectFromLibrary(
  t: (key: string) => string
): Promise<PhotoVariants> {
  haptics.selection();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled) {
    throw new CancellationError(t('harvest.photo.cancel'));
  }

  const photoUri = result.assets[0]?.uri;
  if (!photoUri) {
    throw new Error(t('harvest.photo.errors.no_uri'));
  }

  return captureAndStore(photoUri);
}

type ErrorDisplayProps = {
  error: string;
  onDismiss: () => void;
  t: (key: string) => string;
};

function ErrorDisplay({
  error,
  onDismiss,
  t,
}: ErrorDisplayProps): React.ReactElement {
  return (
    <View className="rounded-lg bg-danger-50 p-3">
      <Text className="text-sm text-danger-700">{error}</Text>
      <Button onPress={onDismiss} variant="link" size="sm" className="mt-2">
        <Text className="text-danger-600">
          {t('harvest.photo.actions.dismiss')}
        </Text>
      </Button>
    </View>
  );
}

type CaptureButtonProps = {
  onPress: () => void;
  disabled: boolean;
  isProcessing: boolean;
  buttonTextKey?: string;
  t: (key: string) => string;
};

function CaptureButton({
  onPress,
  disabled,
  isProcessing,
  buttonTextKey,
  t,
}: CaptureButtonProps): React.ReactElement {
  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      variant="outline"
      className="min-h-[44px]"
      accessibilityLabel={t('harvest.photo.actions.add_photo')}
      accessibilityHint={t('harvest.photo.choose_source')}
      testID="photo-capture-button"
    >
      {isProcessing ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text>{t('harvest.photo.processing_photo')}</Text>
        </View>
      ) : (
        <Text>
          {buttonTextKey
            ? t(buttonTextKey)
            : t('harvest.photo.actions.add_photo')}
        </Text>
      )}
    </Button>
  );
}

function usePhotoCaptureState(): [
  PhotoCaptureState,
  React.Dispatch<React.SetStateAction<PhotoCaptureState>>,
] {
  return useState<PhotoCaptureState>({
    isProcessing: false,
    error: null,
  });
}

function createPhotoCaptureHandler({
  setState,
  t,
  onPhotoCaptured,
  onError,
}: {
  setState: React.Dispatch<React.SetStateAction<PhotoCaptureState>>;
  t: (key: string) => string;
  onPhotoCaptured?: (photoVariant: PhotoVariants) => void;
  onError?: (error: Error) => void;
}): (
  captureFunction: (t: (key: string) => string) => Promise<PhotoVariants>
) => Promise<void> {
  return async (
    captureFunction: (t: (key: string) => string) => Promise<PhotoVariants>
  ) => {
    try {
      setState({ isProcessing: true, error: null });
      const variant = await captureFunction(t);
      onPhotoCaptured?.(variant);
      setState({ isProcessing: false, error: null });
    } catch (err) {
      const isCancellation = err instanceof CancellationError;

      if (isCancellation) {
        setState({ isProcessing: false, error: null });
        return;
      }
      const message =
        err instanceof Error ? err.message : t('harvest.photo.capture_failed');
      setState({ isProcessing: false, error: message });
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };
}

function createPhotoOptionsHandler(
  handlePhotoCapture: (
    captureFunction: (t: (key: string) => string) => Promise<PhotoVariants>
  ) => Promise<void>,
  t: (key: string) => string
): () => void {
  return () => {
    Alert.alert(t('harvest.photo.title'), t('harvest.photo.choose_source'), [
      {
        text: t('harvest.photo.actions.take_photo'),
        onPress: () => handlePhotoCapture(captureFromCamera),
      },
      {
        text: t('harvest.photo.actions.choose_from_library'),
        onPress: () => handlePhotoCapture(selectFromLibrary),
      },
      { text: t('harvest.photo.cancel'), style: 'cancel' },
    ]);
  };
}

export function PhotoCapture({
  onPhotoCaptured,
  onError,
  disabled = false,
  buttonTextKey,
}: PhotoCaptureProps): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = usePhotoCaptureState();

  const handlePhotoCapture = createPhotoCaptureHandler({
    setState,
    t,
    onPhotoCaptured,
    onError,
  });

  const showPhotoOptions = createPhotoOptionsHandler(handlePhotoCapture, t);

  return (
    <View className="gap-2">
      <CaptureButton
        onPress={showPhotoOptions}
        disabled={disabled || state.isProcessing}
        isProcessing={state.isProcessing}
        buttonTextKey={buttonTextKey}
        t={t}
      />
      {state.error && (
        <ErrorDisplay
          error={state.error}
          onDismiss={() => setState({ ...state, error: null })}
          t={t}
        />
      )}
    </View>
  );
}
