/**
 * pH Drift Risk Evaluation
 *
 * Evaluates pH drift risk based on source water alkalinity levels.
 * High alkalinity (>100 mg/L as CaCO₃) indicates increased risk of pH drift
 * requiring more frequent monitoring and adjustment.
 *
 * Requirements: 8.2, 8.6
 */

import type { SourceWaterProfile } from '../types';

/**
 * Alkalinity threshold for pH drift warning (mg/L as CaCO₃)
 * Based on requirements: ≥120–150 mg/L triggers warning
 */
export const PH_DRIFT_THRESHOLD_MIN = 120; // Lower threshold for warning
export const PH_DRIFT_THRESHOLD_HIGH = 150; // Higher threshold for critical warning

/**
 * pH drift risk levels
 */
export const PhDriftRiskLevel = {
  NONE: 'none',
  MODERATE: 'moderate',
  HIGH: 'high',
} as const;

export type PhDriftRiskLevelType =
  (typeof PhDriftRiskLevel)[keyof typeof PhDriftRiskLevel];

/**
 * pH drift risk assessment result
 */
export type PhDriftRiskAssessment = {
  hasRisk: boolean;
  riskLevel: PhDriftRiskLevelType;
  message: string | null;
  educationalContent: string | null;
  helpUrl: string | null;
};

/**
 * Evaluate pH drift risk based on source water alkalinity
 *
 * Educational messaging approach (Req 8.6):
 * - Phrased as educational guidance, not product promotion
 * - Includes actionable mitigation strategies
 * - Links to help documentation
 *
 * @param profile - Source water profile
 * @returns PhDriftRiskAssessment
 */
export function evaluatePhDriftRisk(
  profile: SourceWaterProfile
): PhDriftRiskAssessment {
  const alkalinity = profile.alkalinityMgPerLCaco3;

  // No risk: alkalinity below threshold
  if (alkalinity < PH_DRIFT_THRESHOLD_MIN) {
    return {
      hasRisk: false,
      riskLevel: PhDriftRiskLevel.NONE,
      message: null,
      educationalContent: null,
      helpUrl: null,
    };
  }

  // Moderate risk: alkalinity between 120-150 mg/L
  if (alkalinity < PH_DRIFT_THRESHOLD_HIGH) {
    return {
      hasRisk: true,
      riskLevel: PhDriftRiskLevel.MODERATE,
      message: 'nutrient.phDrift.moderateRisk',
      educationalContent: 'nutrient.phDrift.moderateRiskGuidance',
      helpUrl: '/help/alkalinity-ph-drift',
    };
  }

  // High risk: alkalinity ≥150 mg/L
  return {
    hasRisk: true,
    riskLevel: PhDriftRiskLevel.HIGH,
    message: 'nutrient.phDrift.highRisk',
    educationalContent: 'nutrient.phDrift.highRiskGuidance',
    helpUrl: '/help/alkalinity-ph-drift',
  };
}

/**
 * Check if a profile has pH drift risk (helper function)
 *
 * @param profile - Source water profile
 * @returns boolean
 */
export function hasPhDriftRisk(profile: SourceWaterProfile): boolean {
  return profile.alkalinityMgPerLCaco3 >= PH_DRIFT_THRESHOLD_MIN;
}

/**
 * Get pH drift mitigation strategies based on risk level
 *
 * Educational content (Req 8.6) - no product promotion
 *
 * @param riskLevel - Risk level from assessment
 * @returns Array of mitigation strategy keys (i18n)
 */
export function getPhDriftMitigationStrategies(
  riskLevel: PhDriftRiskLevel
): string[] {
  switch (riskLevel) {
    case PhDriftRiskLevel.MODERATE:
      return [
        'nutrient.phDrift.mitigation.monitorFrequently',
        'nutrient.phDrift.mitigation.bufferSolutions',
        'nutrient.phDrift.mitigation.gradualAdjustment',
      ];

    case PhDriftRiskLevel.HIGH:
      return [
        'nutrient.phDrift.mitigation.monitorDaily',
        'nutrient.phDrift.mitigation.acidInjection',
        'nutrient.phDrift.mitigation.roBlending',
        'nutrient.phDrift.mitigation.sulfuricAcid',
      ];

    case PhDriftRiskLevel.NONE:
    default:
      return [];
  }
}

/**
 * Format alkalinity value for display
 *
 * @param alkalinityMgPerL - Alkalinity in mg/L as CaCO₃
 * @returns Formatted string with units
 */
export function formatAlkalinity(alkalinityMgPerL: number): string {
  return `${alkalinityMgPerL.toFixed(0)} mg/L as CaCO₃`;
}
