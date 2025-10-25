/**
 * Action Plan Generator Module
 *
 * Generates contextual, actionable guidance based on assessment results.
 * Implements safety guardrails and measure-before-change preconditions.
 *
 * Requirements:
 * - 3.1: Display specific next-best-action steps with 1-tap task creation
 * - 3.2: Provide 24-48 hour immediate steps and diagnostic checks
 * - 3.3: Generic guidance, no product promotion, safety guardrails
 * - 3.4: Enable task creation and playbook adjustments with tracking
 * - 3.5: Numbered sequential steps with measure-before-change approach
 */

import type {
  AssessmentActionPlan,
  AssessmentPlantContext,
  AssessmentResult,
} from '@/types/assessment';

import { getActionPlanTemplate } from './action-plan-templates';

/**
 * Action Plan Generator Service
 *
 * Generates contextual action plans based on assessment results and plant context.
 */
export class ActionPlanGenerator {
  /**
   * Generate action plan for an assessment result
   *
   * @param assessment - Assessment result with predicted class and confidence
   * @param context - Plant context for personalization
   * @returns Complete action plan with steps, checks, warnings, and disclaimers
   */
  generatePlan(
    assessment: AssessmentResult,
    context: AssessmentPlantContext
  ): AssessmentActionPlan {
    const classId = assessment.topClass.id;
    const confidence = assessment.calibratedConfidence;

    // Get base template for the predicted class
    const template = getActionPlanTemplate(classId);

    // Clone template to avoid mutations
    const plan: AssessmentActionPlan = {
      immediateSteps: [...template.immediateSteps],
      shortTermActions: [...template.shortTermActions],
      diagnosticChecks: [...template.diagnosticChecks],
      warnings: [...template.warnings],
      disclaimers: [...template.disclaimers],
    };

    // Add confidence-based warnings for low confidence results
    if (confidence < 0.7) {
      plan.warnings.unshift(
        'AI confidence is below 70%. Consider retaking photos or consulting the community for additional perspectives.'
      );
    }

    // Add context-specific adjustments if metadata is available
    if (context.metadata) {
      this.applyContextualAdjustments(plan, context, classId);
    }

    return plan;
  }

  /**
   * Apply contextual adjustments based on plant metadata
   *
   * @param plan - Action plan to adjust (mutated in place)
   * @param context - Plant context with metadata
   * @param classId - Assessment class ID
   */
  private applyContextualAdjustments(
    plan: AssessmentActionPlan,
    context: AssessmentPlantContext,
    classId: string
  ): void {
    const { stage, setup_type } = context.metadata ?? {};

    // Add stage-specific guidance for nutrient deficiencies
    if (
      classId.includes('deficiency') &&
      stage &&
      ['seedling', 'early_veg'].includes(stage)
    ) {
      plan.warnings.push(
        'Young plants are sensitive to nutrient changes. Use reduced strength (25-50%) when adjusting feeds.'
      );
    }

    // Add setup-specific guidance for environmental issues
    if (
      ['overwatering', 'underwatering'].includes(classId) &&
      setup_type === 'hydro'
    ) {
      plan.immediateSteps.push({
        title: 'Check hydroponic system',
        description:
          'Verify pump function, check for clogs, and ensure proper oxygenation of nutrient solution.',
        timeframe: '0-24 hours',
        priority: 'high',
      });
    }

    // Add outdoor-specific guidance for pests/pathogens
    if (
      ['spider_mites', 'powdery_mildew'].includes(classId) &&
      setup_type === 'outdoor'
    ) {
      plan.shortTermActions.push({
        title: 'Consider preventive measures for outdoor grows',
        description:
          'Outdoor environments are more prone to reinfection. Monitor neighboring plants and consider companion planting.',
        timeframe: '24-48 hours',
        priority: 'medium',
      });
    }
  }

  /**
   * Validate that an action plan meets safety requirements
   *
   * @param plan - Action plan to validate
   * @returns True if plan passes safety checks
   */
  validatePlan(plan: AssessmentActionPlan): boolean {
    // Ensure disclaimers are present
    if (!plan.disclaimers || plan.disclaimers.length === 0) {
      return false;
    }

    // Ensure corrective actions have diagnostic checks
    const hasCorrective = plan.immediateSteps.some(
      (step) =>
        step.description.toLowerCase().includes('adjust') ||
        step.description.toLowerCase().includes('add') ||
        step.description.toLowerCase().includes('increase')
    );

    if (hasCorrective && plan.diagnosticChecks.length === 0) {
      return false;
    }

    return true;
  }
}

/**
 * Singleton instance for convenience
 */
export const actionPlanGenerator = new ActionPlanGenerator();

/**
 * Generate action plan (convenience function)
 *
 * @param assessment - Assessment result
 * @param context - Plant context
 * @returns Action plan
 */
export function generateActionPlan(
  assessment: AssessmentResult,
  context: AssessmentPlantContext
): AssessmentActionPlan {
  return actionPlanGenerator.generatePlan(assessment, context);
}
