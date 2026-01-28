import { randomUUID } from 'expo-crypto';
import { type JSX, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { stripExifData } from '@/lib/assessment/image-processing';
import { useCameraLifecycle } from '@/lib/assessment/use-camera-lifecycle';
import { haptics } from '@/lib/haptics';
import { qualityAssessmentEngine } from '@/lib/quality/engine';
import { deleteFile } from '@/lib/utils/filesystem';
import type {
  CapturedPhoto,
  GuidanceMode,
  QualityResult,
} from '@/types/assessment';

import { CaptureButton } from './capture-button';
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
}: VisionCameraCaptureProps): JSX.Element {
  const { t } = useTranslation();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { isActive } = useCameraLifecycle();
  const [isCapturing, setIsCapturing] = useState(false);
  const isCapturingRef = useRef(false);

  const handleCapture = useCallback(async (): Promise<void> => {
    if (!camera.current || isCapturingRef.current) return;

    haptics.medium();
    isCapturingRef.current = true;
    setIsCapturing(true);
    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });

      // Strip EXIF data
      const processed = await stripExifData(`file://${photo.path}`);
      // Delete original file to remove EXIF metadata
      await deleteFile(`file://${photo.path}`);

      const qualityResult: QualityResult =
        await qualityAssessmentEngine.assessPhoto(processed.uri);

      const capturedPhoto: CapturedPhoto = {
        id: randomUUID(),
        uri: processed.uri,
        timestamp: Date.now(),
        qualityScore: qualityResult,
        metadata: processed.metadata,
      };

      onPhotoCapture(capturedPhoto);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [onError, onPhotoCapture]);

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color={colors.white} />
        <Text className="mt-4 text-neutral-300">
          {t('assessment.camera.errors.camera_failed')}
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

      <CaptureButton onPress={handleCapture} isCapturing={isCapturing} />
    </View>
  );
}
