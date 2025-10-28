/**
 * Assessment Action Plan Accessibility Utilities
 *
 * Provides accessibility labels, hints, and announcements for action plans,
 * action steps, and diagnostic checks.
 */

import type { TFunction } from 'i18next';
import type { AccessibilityProps } from 'react-native';

import type {
  AssessmentActionPlan,
  AssessmentActionStep,
} from '@/types/assessment';

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
