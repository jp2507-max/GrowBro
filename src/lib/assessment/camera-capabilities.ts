import { Platform } from 'react-native';

export type CameraCapabilities = {
  supportsFrameProcessors: boolean;
  supportsVisionCamera: boolean;
  recommendedMode: 'vision-camera' | 'expo-camera';
};

/**
 * Detect available camera capabilities
 * VisionCamera with Frame Processors is preferred for real-time quality feedback
 * expo-camera is used as fallback for post-capture quality checks
 */
export function detectCameraCapabilities(): CameraCapabilities {
  // Frame Processors are enabled in app.config.cjs
  // They require native build (dev client) and are available on both iOS and Android
  const supportsFrameProcessors =
    Platform.OS === 'ios' || Platform.OS === 'android';

  // VisionCamera is available when Frame Processors are supported and module is available
  let visionCameraAvailable = false;
  try {
    // We detect module availability at runtime without bundling it eagerly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-vision-camera');
    visionCameraAvailable = true;
  } catch {
    // Module not available
  }
  const supportsVisionCamera = supportsFrameProcessors && visionCameraAvailable;

  // Prefer VisionCamera when available for better UX
  const recommendedMode: 'vision-camera' | 'expo-camera' = supportsVisionCamera
    ? 'vision-camera'
    : 'expo-camera';

  return {
    supportsFrameProcessors,
    supportsVisionCamera,
    recommendedMode,
  };
}

/**
 * Check if Frame Processors are available
 */
export function areFrameProcessorsAvailable(): boolean {
  const { supportsFrameProcessors } = detectCameraCapabilities();
  return supportsFrameProcessors;
}

/**
 * Get the recommended camera mode based on device capabilities
 */
export function getRecommendedCameraMode(): 'vision-camera' | 'expo-camera' {
  const { recommendedMode } = detectCameraCapabilities();
  return recommendedMode;
}
