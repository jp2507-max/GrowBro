import { randomUUID } from 'expo-crypto';
import { type JSX, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

import { GlassSurface } from '@/components/shared/glass-surface';
import { Button, Text, View } from '@/components/ui';
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

import { CaptureGuidance } from './capture-guidance';

type VisionCameraCaptureProps = {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  guidanceMode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
  onError?: (err: Error) => void;
};

const styles = StyleSheet.create({
  glassButton: {
    padding: 8,
    borderRadius: 99,
  },
});

type CaptureButtonProps = {
  onPress: () => void;
  isCapturing: boolean;
};

function CaptureButton({
  onPress,
  isCapturing,
}: CaptureButtonProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <View className="absolute inset-x-0 bottom-0 items-center pb-12">
      <GlassSurface
        isInteractive
        style={styles.glassButton}
        fallbackClassName="bg-white/20"
      >
        <Button
          onPress={onPress}
          disabled={isCapturing}
          className="size-20 items-center justify-center rounded-full bg-neutral-100"
          testID="capture-button"
          accessibilityRole="button"
          accessibilityLabel={t('assessment.camera.actions.capture')}
          accessibilityHint={t('assessment.camera.actions.capture_hint')}
        >
          {isCapturing ? (
            <View
              accessible={true}
              accessibilityLabel={t('assessment.camera.status.capturing')}
              accessibilityHint={t('assessment.camera.status.capturing_hint')}
              accessibilityRole="progressbar"
            >
              <ActivityIndicator size="small" color={colors.black} />
            </View>
          ) : (
            <View className="size-16 rounded-full border-4 border-charcoal-950 bg-neutral-100" />
          )}
        </Button>
      </GlassSurface>
    </View>
  );
}

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

    haptics.selection();
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
