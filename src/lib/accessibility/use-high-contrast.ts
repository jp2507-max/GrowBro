/**
 * High Contrast Mode Hook
 *
 * Detects system-level high contrast preference and provides utilities
 * for applying high contrast variants in UI components.
 *
 * Requirements:
 * - Task 11.1: High contrast mode support for camera UI and result displays
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect and track high contrast mode preference
 *
 * @returns Object with high contrast state and utilities
 */
export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check initial state
    AccessibilityInfo.isHighTextContrastEnabled()
      .then((enabled) => {
        setIsHighContrast(enabled ?? false);
      })
      .catch(() => {
        // Fallback to false if API not available
        setIsHighContrast(false);
      });

    // Listen for changes (iOS only, Android doesn't support change events)
    const subscription = AccessibilityInfo.addEventListener(
      'highTextContrastChanged',
      (enabled) => {
        setIsHighContrast(enabled);
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  return {
    isHighContrast,
    /**
     * Get high contrast variant of a color class
     * @param baseClass - Base Tailwind color class
     * @returns High contrast variant class
     */
    getContrastClass: (baseClass: string): string => {
      if (!isHighContrast) return baseClass;

      // Map base classes to high contrast variants
      const contrastMap: Record<string, string> = {
        'text-neutral-600': 'text-neutral-900',
        'text-neutral-500': 'text-neutral-800',
        'text-neutral-400': 'text-neutral-700',
        'bg-neutral-100': 'bg-white',
        'bg-neutral-200': 'bg-white',
        'border-neutral-300': 'border-neutral-900',
        'border-neutral-200': 'border-neutral-800',
      };

      return contrastMap[baseClass] || baseClass;
    },
    /**
     * Get high contrast border width
     * @param baseWidth - Base border width
     * @returns High contrast border width
     */
    getBorderWidth: (baseWidth: number = 1): number => {
      return isHighContrast ? Math.max(baseWidth, 2) : baseWidth;
    },
  };
}
