import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { v4 as uuidv4 } from 'uuid';

import { Button, Text, View } from '@/components/ui';
import { stripExifData } from '@/lib/assessment/image-processing';
import { useCameraLifecycle } from '@/lib/assessment/use-camera-lifecycle';
import { qualityAssessmentEngine } from '@/lib/quality/engine';
import type {
  CapturedPhoto,
  GuidanceMode,
  QualityResult,
} from '@/types/assessment';

import { CaptureGuidance } from './capture-guidance';

type VisionCameraCaptureProps = {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  guidanceMode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
  onError?: (err: Error) => void;
};

export function VisionCameraCapture({
  onPhotoCapture,
  guidanceMode,
  photoCount,
  maxPhotos,
  onError,
}: VisionCameraCaptureProps) {
  const { t } = useTranslation();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { isActive } = useCameraLifecycle();
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });

      // Strip EXIF data
      const processed = await stripExifData(`file://${photo.path}`);

      const qualityResult: QualityResult =
        await qualityAssessmentEngine.assessPhoto(processed.uri);

      const capturedPhoto: CapturedPhoto = {
        id: uuidv4(),
        uri: processed.uri,
        timestamp: Date.now(),
        qualityScore: qualityResult,
        metadata: processed.metadata,
      };

      onPhotoCapture(capturedPhoto);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onError, onPhotoCapture]);

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="mt-4 text-neutral-300">
          {t('assessment.camera.errors.cameraFailed')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-charcoal-950">
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        photo={true}
      />

      <CaptureGuidance
        mode={guidanceMode}
        photoCount={photoCount}
        maxPhotos={maxPhotos}
      />

      {/* Capture Button */}
      <View className="absolute inset-x-0 bottom-0 items-center pb-12">
        <Button
          onPress={handleCapture}
          disabled={isCapturing}
          className="size-20 rounded-full bg-neutral-100"
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <View className="size-16 rounded-full border-4 border-charcoal-950 bg-neutral-100" />
          )}
        </Button>
      </View>
    </View>
  );
}
