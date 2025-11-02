/**
 * Flash message utilities for displaying toasts
 */

import { showMessage } from 'react-native-flash-message';

/**
 * Show success message toast
 */
export function showSuccessMessage(message: string) {
  showMessage({
    message,
    type: 'success',
    duration: 3000,
  });
}

/**
 * Show error message toast
 */
export function showErrorMessage(message: string) {
  showMessage({
    message,
    type: 'danger',
    duration: 4000,
  });
}

/**
 * Show info message toast
 */
export function showInfoMessage(message: string) {
  showMessage({
    message,
    type: 'info',
    duration: 3000,
  });
}
