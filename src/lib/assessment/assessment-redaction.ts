import * as ImageManipulator from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';

import type { AssessmentPlantContext } from '@/types/assessment';

export type RedactedAssessmentData = {
  redactedImageUri: string;
  sanitizedContext: Partial<AssessmentPlantContext>;
  anonymousFilename: string;
};

/**
 * Redact assessment data for community sharing
 * - Strip EXIF metadata
 * - Re-encode image with quality reduction
 * - Generate new random filename (no linkage to original)
 * - Sanitize plant context (remove PII)
 */
export async function redactAssessmentForCommunity(
  imageUri: string,
  plantContext: AssessmentPlantContext
): Promise<RedactedAssessmentData> {
  // 1. Strip EXIF and re-encode image
  const manipResult = await ImageManipulator.manipulateAsync(
    imageUri,
    [], // No transformations, just re-encode
    {
      compress: 0.85, // Quality reduction to remove forensic traces
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  // 2. Generate new random filename (no linkage to original)
  const anonymousFilename = `${uuidv4()}.jpg`;

  // 3. Sanitize plant context (remove all metadata that might contain PII)
  const sanitizedContext: Partial<AssessmentPlantContext> = {
    id: plantContext.id,
    // metadata removed - may contain strain, notes, setup details, etc.
  };

  return {
    redactedImageUri: manipResult.uri,
    sanitizedContext,
    anonymousFilename,
  };
}

/**
 * Sanitize plant context for sharing (remove PII)
 */
export function sanitizePlantContextForSharing(
  context: AssessmentPlantContext
): Partial<AssessmentPlantContext> {
  // Remove all metadata that might contain PII
  return {
    id: context.id,
    // metadata removed - may contain strain, notes, etc.
  };
}

/**
 * Check if assessment can be shared (has consent)
 */
export function canShareAssessment(consentedForTraining: boolean): boolean {
  return consentedForTraining === true;
}

/**
 * Create redacted community post text from assessment
 * - Remove specific plant names
 * - Remove personal notes
 * - Keep only educational information
 */
export function createRedactedPostText(
  originalText: string,
  plantContext: AssessmentPlantContext
): string {
  let redactedText = originalText;

  // Remove strain name if present in metadata
  const strainName = plantContext.metadata?.strain;
  if (strainName) {
    redactedText = redactedText.replace(
      new RegExp(strainName, 'gi'),
      '[Plant]'
    );
  }

  // Remove any URLs or email addresses
  redactedText = redactedText.replace(/https?:\/\/[^\s]+/g, '[link removed]');
  redactedText = redactedText.replace(
    /[\w.-]+@[\w.-]+\.\w+/g,
    '[email removed]'
  );

  // Remove phone numbers
  redactedText = redactedText.replace(
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    '[phone removed]'
  );

  return redactedText.trim();
}
