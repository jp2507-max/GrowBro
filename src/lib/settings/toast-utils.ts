/**
 * Toast notification utilities for settings screens
 * Requirements: 2.3, 2.8, 12.1
 *
 * Provides consistent success/error feedback for settings operations
 * with proper accessibility announcements.
 */

import { showMessage } from 'react-native-flash-message';

type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  description?: string;
  duration?: number;
  type?: ToastType;
  onPress?: () => void;
}

/**
 * Show success toast for settings operations
 */
export function showSuccessToast(
  message: string,
  description?: string,
  duration = 3000
) {
  showMessage({
    message,
    description,
    type: 'success',
    duration,
    icon: 'success',
    accessibilityLiveRegion: 'polite',
  } as any); // Type augmentation for accessibility props
}

/**
 * Show error toast for settings operations
 */
export function showErrorToast(
  message: string,
  description?: string,
  duration = 4000
) {
  showMessage({
    message,
    description,
    type: 'danger',
    duration,
    icon: 'danger',
    accessibilityLiveRegion: 'assertive',
  } as any);
}

/**
 * Show retry toast for failed sync operations
 * Requirements: 2.8
 */
export function showRetryToast(
  message: string,
  onRetry: () => void,
  description?: string
) {
  showMessage({
    message,
    description: description ?? 'Tap to retry',
    type: 'warning',
    duration: 6000,
    icon: 'warning',
    onPress: onRetry,
    accessibilityLiveRegion: 'polite',
  } as any);
}

/**
 * Show info toast for general notifications
 */
export function showInfoToast(
  message: string,
  description?: string,
  duration = 3000
) {
  showMessage({
    message,
    description,
    type: 'info',
    duration,
    icon: 'info',
    accessibilityLiveRegion: 'polite',
  } as any);
}

/**
 * Show offline toast when network-dependent action is attempted
 * Requirements: 2.9
 */
export function showOfflineToast() {
  showMessage({
    message: 'No internet connection',
    description:
      'This action requires internet. Changes will sync when online.',
    type: 'warning',
    duration: 4000,
    icon: 'warning',
    accessibilityLiveRegion: 'polite',
  } as any);
}

/**
 * Show custom toast with all options
 */
export function showToast(options: ToastOptions) {
  const {
    message,
    description,
    duration = 3000,
    type = 'info',
    onPress,
  } = options;

  showMessage({
    message,
    description,
    type,
    duration,
    icon: type,
    onPress,
    accessibilityLiveRegion: type === 'danger' ? 'assertive' : 'polite',
  } as any);
}
