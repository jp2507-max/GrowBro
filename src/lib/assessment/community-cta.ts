import type { AssessmentResult } from '@/types/assessment';

/**
 * Determines if the community CTA should be shown for an assessment result.
 * CTA is shown when:
 * - Calibrated confidence is below 70% threshold
 * - OR the assessment class is marked as out-of-distribution (OOD)
 *
 * @param assessment - The assessment result to evaluate
 * @returns true if community CTA should be displayed
 */
export function shouldShowCommunityCTA(assessment: AssessmentResult): boolean {
  const CONFIDENCE_THRESHOLD = 0.7;

  // Show CTA if confidence is below threshold
  if (assessment.calibratedConfidence < CONFIDENCE_THRESHOLD) {
    return true;
  }

  // Show CTA if class is marked as out-of-distribution
  if (assessment.topClass.isOod) {
    return true;
  }

  return false;
}

/**
 * Gets the appropriate CTA message based on the assessment result.
 * Returns different messages for low confidence vs OOD classifications.
 *
 * @param assessment - The assessment result
 * @returns Translation key for the CTA message
 */
export function getCommunityCTAMessage(
  assessment: AssessmentResult
): 'askCommunity' | 'getSecondOpinion' {
  // Use "get second opinion" for low confidence
  if (assessment.calibratedConfidence < 0.7) {
    return 'getSecondOpinion';
  }

  // Use "ask community" for OOD/unknown cases
  return 'askCommunity';
}

/**
 * Determines the urgency level of the community CTA.
 * Higher urgency for very low confidence or critical issues.
 *
 * @param assessment - The assessment result
 * @returns Urgency level: 'high' | 'medium' | 'low'
 */
export function getCommunityCTAUrgency(
  assessment: AssessmentResult
): 'high' | 'medium' | 'low' {
  const VERY_LOW_CONFIDENCE = 0.5;

  // High urgency for very low confidence
  if (assessment.calibratedConfidence < VERY_LOW_CONFIDENCE) {
    return 'high';
  }

  // High urgency for OOD cases
  if (assessment.topClass.isOod) {
    return 'high';
  }

  // Medium urgency for moderate low confidence
  return 'medium';
}
