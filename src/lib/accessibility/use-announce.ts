/**
 * Screen Reader Announcement Hook
 *
 * Provides utilities for announcing dynamic content changes to screen readers.
 *
 * Requirements:
 * - Task 11.1: Screen reader support for dynamic content
 */

import { useCallback, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook for announcing messages to screen readers
 *
 * @returns Object with announce function
 */
export function useAnnounce() {
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Announces a message to screen readers
   *
   * @param message - Message to announce
   * @param options - Announcement options
   */
  const announce = useCallback(
    (
      message: string,
      options?: {
        /** Delay before announcement in ms */
        delay?: number;
        /** Queue announcement instead of interrupting */
        queue?: boolean;
      }
    ) => {
      const { delay = 0, queue = false } = options ?? {};

      const runAnnouncement = () =>
        new Promise<void>((resolve) => {
          const invoke = () => {
            AccessibilityInfo.announceForAccessibility(message);
            resolve();
          };

          if (delay > 0) {
            setTimeout(invoke, delay);
          } else {
            invoke();
          }
        });

      if (queue) {
        queueRef.current = queueRef.current.then(() => runAnnouncement());
        void queueRef.current;
        return;
      }

      void runAnnouncement();
    },
    []
  );

  return { announce };
}

/**
 * Announces a success message
 *
 * @param message - Success message
 */
export function announceSuccess(message: string): void {
  AccessibilityInfo.announceForAccessibility(`Success: ${message}`);
}

/**
 * Announces an error message
 *
 * @param message - Error message
 */
export function announceError(message: string): void {
  AccessibilityInfo.announceForAccessibility(`Error: ${message}`);
}

/**
 * Announces a warning message
 *
 * @param message - Warning message
 */
export function announceWarning(message: string): void {
  AccessibilityInfo.announceForAccessibility(`Warning: ${message}`);
}

/**
 * Announces loading state
 *
 * @param isLoading - Whether content is loading
 * @param message - Optional custom message
 */
export function announceLoading(isLoading: boolean, message?: string): void {
  if (isLoading) {
    AccessibilityInfo.announceForAccessibility(
      message || 'Loading, please wait'
    );
  } else {
    AccessibilityInfo.announceForAccessibility(message || 'Loading complete');
  }
}
