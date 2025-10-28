import { Camera } from 'expo-camera';
import { Camera as VisionCamera } from 'react-native-vision-camera';

import type { CameraPermissionStatus } from '@/types/assessment';

/**
 * Request camera permissions using VisionCamera (preferred) or expo-camera (fallback)
 */
export async function requestCameraPermission(): Promise<CameraPermissionStatus> {
  try {
    // Try VisionCamera first (more granular permissions)
    const permission = await VisionCamera.requestCameraPermission();
    return mapVisionCameraPermission(permission);
  } catch {
    // Fallback to expo-camera
    const { status } = await Camera.requestCameraPermissionsAsync();
    return mapExpoCameraPermission(status);
  }
}

/**
 * Check current camera permission status
 */
export async function checkCameraPermission(): Promise<CameraPermissionStatus> {
  try {
    // Try VisionCamera first
    const permission = await VisionCamera.getCameraPermissionStatus();
    return mapVisionCameraPermission(permission);
  } catch {
    // Fallback to expo-camera
    const { status } = await Camera.getCameraPermissionsAsync();
    return mapExpoCameraPermission(status);
  }
}

/**
 * Map VisionCamera permission status to our unified type
 */
function mapVisionCameraPermission(status: string): CameraPermissionStatus {
  switch (status) {
    case 'granted':
    case 'authorized':
      return 'granted';
    case 'denied':
    case 'not-determined':
      return status === 'denied' ? 'denied' : 'undetermined';
    case 'restricted':
      return 'restricted';
    default:
      return 'undetermined';
  }
}

/**
 * Map expo-camera permission status to our unified type
 */
function mapExpoCameraPermission(status: string): CameraPermissionStatus {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
      return 'undetermined';
    default:
      return 'undetermined';
  }
}

/**
 * Check if camera permission is granted
 */
export async function isCameraPermissionGranted(): Promise<boolean> {
  const status = await checkCameraPermission();
  return status === 'granted';
}
