/**
 * Assessment Accessibility Utilities
 *
 * Provides accessibility labels, hints, and announcements for AI photo assessment features.
 * These utilities work with i18next for localization.
 *
 * Requirements:
 * - Task 11.1: Comprehensive accessibility features
 * - Requirement 12: Accessible tooltips for confidence and taxonomy
 *
 * Usage:
 * ```tsx
 * import { useTranslation } from 'react-i18next';
 * import { getCameraControlA11yProps } from '@/lib/accessibility/assessment-a11y';
 *
 * const { t } = useTranslation();
 * const a11yProps = getCameraControlA11yProps({
 *   action: 'capture',
 *   photoCount,
 *   maxPhotos,
 *   t,
 * });
 * <Button {...a11yProps} />
 * ```
 */

import type { TFunction } from 'i18next';
import type { AccessibilityProps } from 'react-native';

import type {
  AssessmentActionPlan,
  AssessmentActionStep,
  AssessmentResult,
  QualityResult,
} from '@/types/assessment';

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

/**
 * Creates accessibility props for action plan step
 */
export function getActionStepA11yProps(options: {
  step: AssessmentActionStep;
  index: number;
  total: number;
  t: TFunction;
}): Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole'
> {
  const { step, index, total, t } = options;

  return {
    accessibilityRole: step.taskTemplate ? 'button' : 'text',
    accessibilityLabel: t('accessibility.assessment.action_step.label', {
      index,
      total,
      title: step.title,
      description: step.description,
      timeframe: step.timeframe,
      priority: step.priority,
    }),
    accessibilityHint: step.taskTemplate
      ? t('accessibility.assessment.action_step.hint_with_task')
      : undefined,
  };
}

/**
 * Creates accessibility props for diagnostic check
 */
export function getDiagnosticCheckA11yProps(options: {
  checkName: string;
  estimatedMinutes?: number;
  t: TFunction;
}): Pick<AccessibilityProps, 'accessibilityLabel'> {
  const { checkName, estimatedMinutes, t } = options;

  return {
    accessibilityLabel: estimatedMinutes
      ? t('accessibility.assessment.diagnostic.label_with_time', {
          name: checkName,
          minutes: estimatedMinutes,
        })
      : checkName,
  };
}

/**
 * Announces action plan to screen readers
 */
export function announceActionPlan(options: {
  plan: AssessmentActionPlan;
  t: TFunction;
}): string {
  const { plan, t } = options;

  return t('accessibility.assessment.action_plan.ready', {
    immediateCount: plan.immediateSteps.length,
    shortTermCount: plan.shortTermActions.length,
    diagnosticCount: plan.diagnosticChecks.length,
  });
}

/**
 * Creates accessibility props for community CTA button
 */
export function getCommunityCTAA11yProps(options: {
  confidence: number;
  t: TFunction;
}): Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole'
> {
  const { confidence, t } = options;
  const percent = Math.round(confidence * 100);

  return {
    accessibilityRole: 'button',
    accessibilityLabel: t('accessibility.assessment.community_cta.label', {
      percent,
    }),
    accessibilityHint: t('accessibility.assessment.community_cta.hint'),
  };
}

/**
 * Creates accessibility props for queue status indicator
 */
export function getQueueStatusA11yProps(options: {
  pendingCount: number;
  processingCount: number;
  t: TFunction;
}): Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityLiveRegion'> {
  const { pendingCount, processingCount, t } = options;
  const total = pendingCount + processingCount;

  return {
    accessibilityLabel:
      total === 0
        ? t('accessibility.assessment.queue.empty')
        : t('accessibility.assessment.queue.status', {
            pendingCount,
            processingCount,
          }),
    accessibilityLiveRegion: 'polite',
  };
}
