import { useCallback, useEffect, useState } from 'react';

import type { CameraPermissionStatus } from '@/types/assessment';

import {
  checkCameraPermission,
  requestCameraPermission,
} from './camera-permissions';

export function useCameraPermission() {
  const [status, setStatus] = useState<CameraPermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const permissionStatus = await checkCameraPermission();
      setStatus(permissionStatus);
    } catch (error) {
      console.error('Failed to check camera permission:', error);
      setStatus('denied');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const permissionStatus = await requestCameraPermission();
      setStatus(permissionStatus);
      return permissionStatus;
    } catch (error) {
      console.error('Failed to request camera permission:', error);
      setStatus('denied');
      return 'denied' as CameraPermissionStatus;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    status,
    isLoading,
    isGranted: status === 'granted',
    isDenied: status === 'denied',
    isUndetermined: status === 'undetermined',
    requestPermission,
    checkPermission,
  };
}
