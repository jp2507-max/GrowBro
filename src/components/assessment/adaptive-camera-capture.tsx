import * as React from 'react';

import { getRecommendedCameraMode } from '@/lib/assessment/camera-capabilities';
import type { CapturedPhoto, GuidanceMode } from '@/types/assessment';

import { ExpoCameraCapture } from './expo-camera-capture';
import { VisionCameraCapture } from './vision-camera-capture';

type AdaptiveCameraCaptureProps = {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  guidanceMode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
  onError: (err: Error) => void;
};

/**
 * Adaptive camera component that automatically selects the best available camera implementation
 * - VisionCamera with Frame Processors (preferred for real-time quality feedback)
 * - expo-camera (fallback for post-capture quality checks)
 */
export function AdaptiveCameraCapture(
  props: AdaptiveCameraCaptureProps
): React.ReactElement {
  const cameraMode = getRecommendedCameraMode();

  if (cameraMode === 'vision-camera') {
    return <VisionCameraCapture {...props} />;
  }

  return <ExpoCameraCapture {...props} />;
}
