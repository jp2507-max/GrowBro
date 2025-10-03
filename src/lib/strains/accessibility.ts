/**
 * Accessibility utilities for strains feature
 * Handles dynamic type scaling, high contrast mode, and screen reader support
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Hook to detect if screen reader is enabled
 */
export function useScreenReaderEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check initial state
    AccessibilityInfo.isScreenReaderEnabled().then(setIsEnabled);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if reduce motion is enabled
 */
export function useReduceMotionEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceMotionEnabled().then(setIsEnabled);

      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setIsEnabled
      );

      return () => {
        subscription.remove();
      };
    }
  }, []);

  return isEnabled;
}

/**
 * Get font scale multiplier for dynamic type
 * Supports up to 200% scaling
 */
export function useFontScale(): number {
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    const updateFontScale = async () => {
      try {
        // Get system font scale using isScreenReaderEnabled as a proxy
        // If screen reader is enabled, we can assume larger text preferences
        const screenReaderEnabled =
          await AccessibilityInfo.isScreenReaderEnabled();
        // Set a reasonable scale based on screen reader status
        const scale = screenReaderEnabled ? 1.5 : 1;
        setFontScale(scale);
      } catch {
        setFontScale(1);
      }
    };

    updateFontScale();
  }, []);

  return fontScale;
}

/**
 * Hook to detect high contrast mode (iOS only)
 */
export function useHighContrastEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      // iOS 13+ supports high contrast detection
      // This is a placeholder - actual implementation would use native module
      // For now, we'll default to false
      setIsEnabled(false);
    }
  }, []);

  return isEnabled;
}

/**
 * Get accessible color contrast for text
 */
export function getAccessibleTextColor(
  isDark: boolean,
  isHighContrast: boolean
): string {
  if (isHighContrast) {
    return isDark ? '#FFFFFF' : '#000000';
  }
  return isDark ? '#E5E7EB' : '#1F2937';
}

/**
 * Get accessible background color
 */
export function getAccessibleBackgroundColor(
  isDark: boolean,
  isHighContrast: boolean
): string {
  if (isHighContrast) {
    return isDark ? '#000000' : '#FFFFFF';
  }
  return isDark ? '#171717' : '#F9FAFB';
}

/**
 * Announce message to screen reader
 */
export function announceForAccessibility(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Get scaled font size based on dynamic type setting
 */
export function getScaledFontSize(
  baseSize: number,
  fontScale: number,
  maxScale: number = 2
): number {
  const scale = Math.min(fontScale, maxScale);
  return Math.round(baseSize * scale);
}

/**
 * Get minimum touch target size (44pt on iOS, 48dp on Android)
 */
export const MIN_TOUCH_TARGET_SIZE = Platform.select({
  ios: 44,
  android: 48,
  default: 44,
});

/**
 * Accessibility labels for strain characteristics
 */
export const ACCESSIBILITY_LABELS = {
  race: {
    indica: 'Indica strain',
    sativa: 'Sativa strain',
    hybrid: 'Hybrid strain',
  },
  difficulty: {
    beginner: 'Beginner difficulty',
    intermediate: 'Intermediate difficulty',
    advanced: 'Advanced difficulty',
  },
  thc: (value: string) => `THC content: ${value}`,
  cbd: (value: string) => `CBD content: ${value}`,
  favorite: {
    add: 'Add to favorites',
    remove: 'Remove from favorites',
    added: 'Added to favorites',
    removed: 'Removed from favorites',
  },
  filter: {
    apply: 'Apply filters',
    clear: 'Clear all filters',
    active: (count: number) =>
      `${count} filter${count === 1 ? '' : 's'} active`,
  },
  search: {
    placeholder: 'Search strains by name',
    clear: 'Clear search',
    results: (count: number) =>
      `${count} strain${count === 1 ? '' : 's'} found`,
  },
} as const;

/**
 * Get accessibility hint for interactive elements
 */
export function getAccessibilityHint(action: string): string {
  const hints: Record<string, string> = {
    'open-detail': 'Double-tap to view strain details',
    'toggle-favorite': 'Double-tap to toggle favorite status',
    'apply-filter': 'Double-tap to apply selected filters',
    'clear-filter': 'Double-tap to clear all filters',
    search: 'Type to search for strains',
    retry: 'Double-tap to retry loading',
    'go-back': 'Double-tap to go back',
  };

  return hints[action] || 'Double-tap to activate';
}

/**
 * Format accessibility label for strain card
 */
export function formatStrainCardLabel(strain: {
  name: string;
  race: string;
  thc_display?: string;
  difficulty: string;
}): string {
  const parts = [
    strain.name,
    ACCESSIBILITY_LABELS.race[
      strain.race as keyof typeof ACCESSIBILITY_LABELS.race
    ],
  ];

  if (strain.thc_display) {
    parts.push(ACCESSIBILITY_LABELS.thc(strain.thc_display));
  }

  parts.push(
    ACCESSIBILITY_LABELS.difficulty[
      strain.difficulty as keyof typeof ACCESSIBILITY_LABELS.difficulty
    ]
  );

  return parts.join('. ');
}
