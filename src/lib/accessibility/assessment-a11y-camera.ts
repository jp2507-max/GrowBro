/**
 * Assessment Camera Accessibility Utilities
 *
 * Provides accessibility labels, hints, and announcements for camera controls
 * and photo quality feedback in AI photo assessment features.
 */

import type { TFunction } from 'i18next';
import type { AccessibilityProps } from 'react-native';

import type { QualityResult } from '@/types/assessment';

/**
 * Creates accessibility props for camera capture button
 */
export function getCameraControlA11yProps(options: {
  action: 'capture' | 'retake' | 'confirm' | 'cancel';
  photoCount: number;
  maxPhotos: number;
  t: TFunction;
}): Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole'
> {
  const { action, photoCount, maxPhotos, t } = options;
  return {
    accessibilityRole: 'button',
    accessibilityLabel: t(`accessibility.assessment.camera.${action}_label`, {
      photoCount: photoCount + 1,
      maxPhotos,
      count: photoCount,
    }),
    accessibilityHint: t(`accessibility.assessment.camera.${action}_hint`),
  };
}

/**
 * Creates accessibility props for quality feedback indicator
 */
export function getQualityFeedbackA11yProps(options: {
  quality: QualityResult;
  t: TFunction;
}): Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityLiveRegion'> {
  const { quality, t } = options;
  const issues = quality.issues.map((i) => i.type).join(', ');

  return {
    accessibilityLabel: t(
      quality.acceptable
        ? 'accessibility.assessment.quality.acceptable'
        : 'accessibility.assessment.quality.needs_improvement',
      { score: quality.score, issues }
    ),
    accessibilityLiveRegion: 'polite',
  };
}

/**
 * Announces quality feedback to screen readers
 */
export function announceQualityFeedback(options: {
  quality: QualityResult;
  t: TFunction;
}): string {
  const { quality, t } = options;
  if (quality.acceptable) {
    return t('accessibility.assessment.quality.good');
  }

  const primaryIssue = quality.issues[0];
  if (!primaryIssue) {
    return t('accessibility.assessment.quality.needs_improvement_short');
  }

  return t('accessibility.assessment.quality.issue_detected', {
    type: primaryIssue.type,
    suggestion: primaryIssue.suggestion,
  });
}
