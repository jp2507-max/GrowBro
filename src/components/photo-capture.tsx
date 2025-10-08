import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { captureAndStore } from '@/lib/media/photo-storage-service';
import type { PhotoVariants } from '@/types/photo-storage';

export interface PhotoCaptureProps {
  onPhotoCaptured?: (photoVariants: PhotoVariants) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  buttonText?: string;
}

interface PhotoCaptureState {
  isProcessing: boolean;
  error: string | null;
}

async function captureFromCamera(): Promise<PhotoVariants> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled) {
    throw new Error('Capture cancelled');
  }

  const photoUri = result.assets[0]?.uri;
  if (!photoUri) {
    throw new Error('No photo URI returned from camera');
  }

  return captureAndStore(photoUri);
}

async function selectFromLibrary(): Promise<PhotoVariants> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled) {
    throw new Error('Selection cancelled');
  }

  const photoUri = result.assets[0]?.uri;
  if (!photoUri) {
    throw new Error('No photo URI returned from library');
  }

  return captureAndStore(photoUri);
}

function ErrorDisplay({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-lg bg-danger-50 p-3">
      <Text className="text-sm text-danger-700">{error}</Text>
      <Button onPress={onDismiss} variant="link" size="sm" className="mt-2">
        <Text className="text-danger-600">Dismiss</Text>
      </Button>
    </View>
  );
}

function CaptureButton({
  onPress,
  disabled,
  isProcessing,
  buttonText,
}: {
  onPress: () => void;
  disabled: boolean;
  isProcessing: boolean;
  buttonText?: string;
}) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      variant="outline"
      className="min-h-[44px]"
      accessibilityLabel="Add harvest photo"
      accessibilityHint="Opens photo picker to add a harvest photo from camera or library"
    >
      {isProcessing ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text>Processing photo...</Text>
        </View>
      ) : (
        <Text>{buttonText ?? 'Add Photo'}</Text>
      )}
    </Button>
  );
}

export function PhotoCapture({
  onPhotoCaptured,
  onError,
  disabled = false,
  buttonText,
}: PhotoCaptureProps) {
  const [state, setState] = useState<PhotoCaptureState>({
    isProcessing: false,
    error: null,
  });

  const handlePhotoCapture = async (
    captureFunction: () => Promise<PhotoVariants>
  ) => {
    try {
      setState({ isProcessing: true, error: null });
      const variants = await captureFunction();
      onPhotoCaptured?.(variants);
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        setState({ isProcessing: false, error: null });
        return;
      }
      const message = err instanceof Error ? err.message : 'Capture failed';
      setState({ isProcessing: false, error: message });
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source for your harvest photo', [
      {
        text: 'Take Photo',
        onPress: () => handlePhotoCapture(captureFromCamera),
      },
      {
        text: 'Choose from Library',
        onPress: () => handlePhotoCapture(selectFromLibrary),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View className="gap-2">
      <CaptureButton
        onPress={showPhotoOptions}
        disabled={disabled || state.isProcessing}
        isProcessing={state.isProcessing}
        buttonText={buttonText}
      />
      {state.error && (
        <ErrorDisplay
          error={state.error}
          onDismiss={() => setState({ ...state, error: null })}
        />
      )}
    </View>
  );
}
