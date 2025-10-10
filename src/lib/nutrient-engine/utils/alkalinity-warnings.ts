/**
 * Alkalinity-based pH drift warnings and educational guidance
 *
 * Provides threshold-based detection for pH drift risk based on
 * source water alkalinity levels, with educational content for mitigation.
 *
 * Requirements: 8.2, 8.6
 */

import type { SourceWaterProfile } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Alkalinity thresholds for pH drift warnings (mg/L as CaCO₃)
 */
export const ALKALINITY_THRESHOLDS = {
  /** Low risk: < 100 mg/L - minimal pH drift expected */
  LOW_THRESHOLD: 100,

  /** Moderate risk: 100-150 mg/L - watch for gradual pH rise */
  MODERATE_THRESHOLD: 120,

  /** High risk: ≥ 150 mg/L - expect significant pH drift, adjust nutrients */
  HIGH_THRESHOLD: 150,
} as const;

/**
 * Risk level classification
 */
export type AlkalinityRiskLevel = 'low' | 'moderate' | 'high';

// ============================================================================
// Warning Configuration
// ============================================================================

/**
 * Alkalinity warning information
 */
export type AlkalinityWarning = {
  riskLevel: AlkalinityRiskLevel;
  title: string;
  message: string;
  educationalGuidance: string[];
  mitigationLink: string;
  showInline: boolean; // Show as inline badge/alert vs full warning
};

// ============================================================================
// Warning Detection
// ============================================================================

/**
 * Determines alkalinity risk level from profile
 *
 * @param profile - Source water profile
 * @returns Risk level classification
 */
export function getAlkalinityRiskLevel(
  profile: SourceWaterProfile
): AlkalinityRiskLevel {
  const alkalinity = profile.alkalinityMgPerLCaco3;

  if (alkalinity >= ALKALINITY_THRESHOLDS.HIGH_THRESHOLD) {
    return 'high';
  } else if (alkalinity >= ALKALINITY_THRESHOLDS.MODERATE_THRESHOLD) {
    return 'moderate';
  } else {
    return 'low';
  }
}

/**
 * Gets alkalinity warning configuration if applicable
 *
 * Requirements: 8.2 - Trigger warning when alkalinity > ~100 mg/L CaCO₃
 *
 * @param profile - Source water profile
 * @returns Warning configuration or null if no warning needed
 */
export function getAlkalinityWarning(
  profile: SourceWaterProfile
): AlkalinityWarning | null {
  const riskLevel = getAlkalinityRiskLevel(profile);

  if (riskLevel === 'low') {
    return null;
  }

  const alkalinity = profile.alkalinityMgPerLCaco3;

  if (riskLevel === 'high') {
    return {
      riskLevel: 'high',
      title: 'High pH Drift Risk',
      message: `Your source water has high alkalinity (${alkalinity} mg/L as CaCO₃). This will cause persistent pH rise over time, especially in soilless media.`,
      educationalGuidance: [
        'Use pH Down more frequently to counteract natural buffering',
        'Consider acidic nutrient formulations designed for hard water',
        'Monitor pH daily during first week after reservoir changes',
        'Target lower end of pH range (5.5-5.8) to allow for drift',
        'Consider RO filtration or acidic amendments for long-term control',
      ],
      mitigationLink:
        'https://docs.growbro.app/guides/managing-high-alkalinity-water',
      showInline: true,
    };
  } else {
    // moderate risk
    return {
      riskLevel: 'moderate',
      title: 'Moderate pH Drift Risk',
      message: `Your source water has moderate alkalinity (${alkalinity} mg/L as CaCO₃). Watch for gradual pH rise over 3-5 days.`,
      educationalGuidance: [
        'Check pH every 2-3 days after mixing nutrients',
        'Keep pH Down solution on hand for adjustments',
        'Document pH trends to predict adjustment intervals',
        'Consider slightly acidic nutrient lines if pH rises consistently',
      ],
      mitigationLink:
        'https://docs.growbro.app/guides/understanding-alkalinity',
      showInline: true,
    };
  }
}

/**
 * Checks if alkalinity warning should be displayed
 *
 * @param profile - Source water profile
 * @returns True if warning should be shown
 */
export function shouldShowAlkalinityWarning(
  profile: SourceWaterProfile
): boolean {
  return (
    profile.alkalinityMgPerLCaco3 >= ALKALINITY_THRESHOLDS.MODERATE_THRESHOLD
  );
}

// ============================================================================
// Educational Content (Requirement 8.6)
// ============================================================================

/**
 * Gets educational guidance for alkalinity management
 * (Phrased as educational guidance, not product promotion)
 *
 * @param riskLevel - Current risk level
 * @returns Array of educational tips
 */
export function getAlkalinityEducationalContent(
  riskLevel: AlkalinityRiskLevel
): string[] {
  const baseContent = [
    "Alkalinity measures your water's ability to resist pH changes (buffering capacity)",
    'High alkalinity causes pH to drift upward over time, even with proper nutrients',
    'This is a natural property of your water source, not a problem with your nutrients',
  ];

  const riskSpecificContent: Record<AlkalinityRiskLevel, string[]> = {
    low: [
      'Your alkalinity is in a manageable range',
      'Standard pH management practices should work well',
    ],
    moderate: [
      'Your alkalinity requires regular pH monitoring',
      'pH adjustments every few days are normal and expected',
      'Document your pH patterns to anticipate future adjustments',
    ],
    high: [
      'Your alkalinity will require active pH management',
      'Daily pH monitoring is recommended, especially after reservoir changes',
      'Consider targeting lower pH initially (5.5-5.8) to allow for drift',
      'RO filtration or acidic amendments can help long-term',
    ],
  };

  return [...baseContent, ...riskSpecificContent[riskLevel]];
}

/**
 * Gets alkalinity testing recommendations
 *
 * @returns Educational content about testing frequency
 */
export function getAlkalinityTestingGuidance(): string[] {
  return [
    'Test your source water alkalinity annually or when switching water sources',
    'Professional testing provides most accurate results (check local labs or hydroponic suppliers)',
    'Home testing kits (KH test kits for aquariums) can provide estimates',
    'Record your results in GrowBro to get personalized pH management guidance',
  ];
}
