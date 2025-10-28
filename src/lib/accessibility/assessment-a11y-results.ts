/**
 * Assessment Results Accessibility Utilities
 *
 * Provides accessibility labels, hints, and announcements for assessment results,
 * confidence indicators, and taxonomy information.
 */

import type { TFunction } from 'i18next';
import type { AccessibilityProps } from 'react-native';

import type { AssessmentResult } from '@/types/assessment';

/**
 * Announces assessment result to screen readers
 */
export function announceAssessmentResult(options: {
  result: AssessmentResult;
  t: TFunction;
}): string {
  const { result, t } = options;
  const confidence = Math.round(result.calibratedConfidence * 100);
  const photoCount = result.perImage.length;
  const modeLabel =
    result.mode === 'device'
      ? t('accessibility.assessment.result.mode_device')
      : t('accessibility.assessment.result.mode_cloud');

  if (result.topClass.isOod || confidence < 70) {
    return t('accessibility.assessment.result.low_confidence', {
      confidence,
      count: photoCount,
    });
  }

  return t('accessibility.assessment.result.success', {
    className: result.topClass.name,
    confidence,
    mode: modeLabel,
    count: photoCount,
  });
}

/**
 * Creates accessibility props for confidence indicator
 */
export function getConfidenceA11yProps(options: {
  confidence: number;
  isCalibrated?: boolean;
  t: TFunction;
}): Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole'
> {
  const { confidence, isCalibrated = true, t } = options;
  const percent = Math.round(confidence * 100);
  const typeKey = isCalibrated ? 'calibrated' : 'raw';
  const typeLabel = t(`accessibility.assessment.confidence.type_${typeKey}`);

  return {
    accessibilityRole: 'button',
    accessibilityLabel: t('accessibility.assessment.confidence.label', {
      type: typeLabel,
      percent,
    }),
    accessibilityHint: t('accessibility.assessment.confidence.hint'),
  };
}

/**
 * Creates accessibility props for taxonomy info button
 */
export function getTaxonomyInfoA11yProps(options: {
  className: string;
  t: TFunction;
}): Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole'
> {
  const { className, t } = options;

  return {
    accessibilityRole: 'button',
    accessibilityLabel: t('accessibility.assessment.taxonomy.label', {
      className,
    }),
    accessibilityHint: t('accessibility.assessment.taxonomy.hint'),
  };
}
