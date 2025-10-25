/**
 * Playbook Integration Module
 *
 * Generates playbook adjustment suggestions based on assessment findings.
 * Suggests schedule modifications when AI identifies issues requiring intervention.
 *
 * Requirements:
 * - 3.4: Enable playbook adjustment suggestions with user acceptance tracking
 * - 9.2: Track playbook adjustment rates for analytics
 */

import type {
  AssessmentActionPlan,
  AssessmentPlantContext,
  AssessmentResult,
} from '@/types/assessment';
import type { Playbook } from '@/types/playbook';

/**
 * Playbook adjustment suggestion
 */
export type PlaybookAdjustment = {
  description: string;
  impact: 'schedule' | 'resource' | 'instructions' | 'priority';
  reason: string;
  suggestedDaysDelta?: number; // For schedule adjustments
  affectedPhases?: string[]; // For phase-specific adjustments
};

/**
 * Playbook adjustment options
 */
export type PlaybookAdjustmentOptions = {
  assessment: AssessmentResult;
  plan: AssessmentActionPlan;
  playbook?: Playbook;
  context: AssessmentPlantContext;
};

/**
 * Playbook adjustment result
 */
export type PlaybookAdjustmentResult = {
  adjustments: PlaybookAdjustment[];
  metadata: {
    assessmentId: string;
    classId: string;
    confidence: number;
    suggestedCount: number;
    timestamp: number;
  };
};

/**
 * Playbook Integration Service
 *
 * Analyzes assessment results and suggests playbook modifications.
 */
export class PlaybookIntegrationService {
  /**
   * Suggest playbook adjustments based on assessment
   *
   * @param options - Playbook adjustment options
   * @returns Playbook adjustment suggestions
   */
  suggestAdjustments(
    options: PlaybookAdjustmentOptions
  ): PlaybookAdjustmentResult {
    const { assessment, context } = options;
    const classId = assessment.topClass.id;
    const confidence = assessment.calibratedConfidence;
    const adjustments: PlaybookAdjustment[] = [];

    // Only suggest adjustments for confident assessments
    if (confidence < 0.7) {
      return {
        adjustments: [],
        metadata: {
          assessmentId: '', // Will be set by caller
          classId,
          confidence,
          suggestedCount: 0,
          timestamp: Date.now(),
        },
      };
    }

    // Generate class-specific adjustments
    if (classId.includes('deficiency')) {
      adjustments.push(...this.getNutrientDeficiencyAdjustments(classId));
    } else if (classId === 'overwatering' || classId === 'underwatering') {
      adjustments.push(...this.getWateringAdjustments(classId));
    } else if (classId === 'light_burn') {
      adjustments.push(...this.getLightAdjustments());
    } else if (classId === 'spider_mites' || classId === 'powdery_mildew') {
      adjustments.push(...this.getPestPathogenAdjustments(classId));
    }

    // Add stage-specific adjustments if metadata available
    if (context.metadata?.stage) {
      adjustments.push(
        ...this.getStageSpecificAdjustments(classId, context.metadata.stage)
      );
    }

    return {
      adjustments,
      metadata: {
        assessmentId: '', // Will be set by caller
        classId,
        confidence,
        suggestedCount: adjustments.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Get adjustments for nutrient deficiencies
   */
  private getNutrientDeficiencyAdjustments(
    classId: string
  ): PlaybookAdjustment[] {
    const nutrientName = classId.replace('_deficiency', '').replace('_', ' ');

    return [
      {
        description: `Increase feeding frequency or strength`,
        impact: 'schedule',
        reason: `${nutrientName} deficiency detected. Consider adjusting feed schedule to address nutrient needs.`,
        affectedPhases: ['veg', 'flower'],
      },
      {
        description: 'Add pH monitoring tasks',
        impact: 'instructions',
        reason:
          'Nutrient uptake is pH-dependent. Regular pH checks will help prevent future deficiencies.',
      },
    ];
  }

  /**
   * Get adjustments for watering issues
   */
  private getWateringAdjustments(classId: string): PlaybookAdjustment[] {
    if (classId === 'overwatering') {
      return [
        {
          description: 'Reduce watering frequency',
          impact: 'schedule',
          reason:
            'Overwatering detected. Extend time between watering tasks to allow soil to dry properly.',
          suggestedDaysDelta: 1, // Add 1 day between waterings
        },
        {
          description: 'Add soil moisture check tasks',
          impact: 'instructions',
          reason:
            'Monitor soil moisture before watering to prevent overwatering.',
        },
      ];
    } else {
      return [
        {
          description: 'Increase watering frequency',
          impact: 'schedule',
          reason:
            'Underwatering detected. Add more frequent watering tasks or reminders.',
          suggestedDaysDelta: -1, // Reduce time between waterings
        },
        {
          description: 'Set up watering reminders',
          impact: 'priority',
          reason:
            'Consistent watering is critical. Consider setting reminders.',
        },
      ];
    }
  }

  /**
   * Get adjustments for light issues
   */
  private getLightAdjustments(): PlaybookAdjustment[] {
    return [
      {
        description: 'Add light intensity monitoring tasks',
        impact: 'instructions',
        reason:
          'Light burn detected. Regular PPFD measurements will help maintain optimal light levels.',
      },
      {
        description: 'Review light schedule',
        impact: 'resource',
        reason:
          'Consider adjusting light height or intensity to prevent further stress.',
      },
    ];
  }

  /**
   * Get adjustments for pests and pathogens
   */
  private getPestPathogenAdjustments(classId: string): PlaybookAdjustment[] {
    const issueName = classId.replace('_', ' ');

    return [
      {
        description: 'Add daily inspection tasks',
        impact: 'schedule',
        reason: `${issueName} detected. Daily monitoring is critical during treatment.`,
      },
      {
        description: 'Add environmental monitoring',
        impact: 'instructions',
        reason:
          'Pests and pathogens thrive in certain conditions. Monitor temperature and humidity closely.',
      },
      {
        description: 'Extend current phase',
        impact: 'schedule',
        reason:
          'Treatment and recovery may delay progress. Consider extending current phase by 1-2 weeks.',
        suggestedDaysDelta: 7, // Suggest 1 week extension
        affectedPhases: ['veg', 'flower'],
      },
    ];
  }

  /**
   * Get stage-specific adjustments
   */
  private getStageSpecificAdjustments(
    classId: string,
    stage: string
  ): PlaybookAdjustment[] {
    const adjustments: PlaybookAdjustment[] = [];

    // Early stage issues may require more careful intervention
    if (['seedling', 'early_veg'].includes(stage)) {
      adjustments.push({
        description: 'Use reduced strength interventions',
        impact: 'instructions',
        reason:
          'Young plants are sensitive. All corrective actions should use reduced strength (25-50%).',
      });
    }

    // Flowering stage issues may impact harvest timing
    if (stage === 'flower' && classId !== 'healthy') {
      adjustments.push({
        description: 'Consider harvest timing impact',
        impact: 'schedule',
        reason:
          'Issues during flowering may affect harvest quality or timing. Monitor closely and adjust harvest window if needed.',
      });
    }

    return adjustments;
  }

  /**
   * Check if adjustments should be suggested based on assessment
   *
   * @param assessment - Assessment result
   * @returns True if adjustments are recommended
   */
  shouldSuggestAdjustments(assessment: AssessmentResult): boolean {
    // Don't suggest for healthy plants or low confidence
    if (
      assessment.topClass.id === 'healthy' ||
      assessment.calibratedConfidence < 0.7
    ) {
      return false;
    }

    // Don't suggest for unknown/OOD
    if (assessment.topClass.isOod) {
      return false;
    }

    return true;
  }
}

/**
 * Singleton instance for convenience
 */
export const playbookIntegrationService = new PlaybookIntegrationService();

/**
 * Suggest playbook adjustments (convenience function)
 *
 * @param options - Playbook adjustment options
 * @returns Playbook adjustment result
 */
export function suggestPlaybookAdjustments(
  options: PlaybookAdjustmentOptions
): PlaybookAdjustmentResult {
  return playbookIntegrationService.suggestAdjustments(options);
}
