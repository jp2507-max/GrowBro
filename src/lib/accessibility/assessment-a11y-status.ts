/**
 * Assessment Status Accessibility Utilities
 *
 * Provides accessibility labels and hints for community CTAs and
 * offline queue status indicators.
 */

import type { TFunction } from 'i18next';
import type { AccessibilityProps } from 'react-native';

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
