import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Safe wrapper for haptics calls that handles unavailable native modules.
 * expo-haptics may not be available in Expo Go or when native modules aren't linked.
 */
function safeHaptic(fn: () => Promise<void>): void {
  // Haptics only work on native devices, not web or simulators without haptic support
  if (Platform.OS === 'web') return;

  fn().catch(() => {
    // Silently ignore haptics errors (module unavailable, simulator, etc.)
  });
}

/**
 * Centralized haptics utility for the app.
 * Uses expo-haptics under the hood with safe error handling.
 */
export const haptics = {
  /**
   * A feedback indicating a selection change (e.g. scrolling through a picker)
   */
  selection: () => {
    safeHaptic(() => Haptics.selectionAsync());
  },

  /**
   * Light impact feedback
   */
  light: () => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /**
   * Medium impact feedback
   */
  medium: () => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },

  /**
   * Heavy impact feedback
   */
  heavy: () => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },

  /**
   * Success notification feedback
   */
  success: () => {
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    );
  },

  /**
   * Warning notification feedback
   */
  warning: () => {
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    );
  },

  /**
   * Error notification feedback
   */
  error: () => {
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    );
  },
};
