import { CameraView } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { Button, View } from '@/components/ui';
import {
  generateThumbnail,
  stripExifData,
} from '@/lib/assessment/image-processing';
import { qualityAssessmentEngine } from '@/lib/quality/engine';
import type {
  CapturedPhoto,
  GuidanceMode,
  QualityResult,
} from '@/types/assessment';

import { CaptureGuidance } from './capture-guidance';

type ExpoCameraCaptureProps = {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  guidanceMode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
};

export function ExpoCameraCapture({
  onPhotoCapture,
  guidanceMode,
  photoCount,
  maxPhotos,
}: ExpoCameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

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

      // Generate thumbnail
      await generateThumbnail(processed.uri);

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
      console.error('Failed to capture photo:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onPhotoCapture]);

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
