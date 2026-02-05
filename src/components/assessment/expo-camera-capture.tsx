import { CameraView } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { View } from '@/components/ui';
import { stripExifData } from '@/lib/assessment/image-processing';
import { haptics } from '@/lib/haptics';
import { qualityAssessmentEngine } from '@/lib/quality/engine';
import type {
  CapturedPhoto,
  GuidanceMode,
  QualityResult,
} from '@/types/assessment';

import { CaptureButton } from './capture-button';
import { CaptureGuidance } from './capture-guidance';

type ExpoCameraCaptureProps = {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  guidanceMode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
  onError: (err: Error) => void;
};

export function ExpoCameraCapture({
  onPhotoCapture,
  guidanceMode,
  photoCount,
  maxPhotos,
  onError,
}: ExpoCameraCaptureProps): JSX.Element {
  const cameraRef = useRef<CameraView | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isCapturingRef = useRef(false);

  const handleCapture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isCapturingRef.current) return;

    haptics.medium();
    isCapturingRef.current = true;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo) {
        throw new Error('Failed to capture photo');
      }

      // Strip EXIF data
      const processed = await stripExifData(photo.uri);

      // Delete original file with EXIF data for security
      try {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true });
      } catch (deleteError) {
        console.warn('Failed to delete original camera file:', deleteError);
        // Continue with processed image even if deletion fails
      }

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
      onError(error as Error);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [onPhotoCapture, onError]);

  return (
    <View className="flex-1 bg-charcoal-950">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
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
