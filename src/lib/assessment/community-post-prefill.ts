import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
} from '@/types/assessment';

import { redactAssessmentForCommunity } from './assessment-redaction';

export type RedactedImage = {
  uri: string;
  filename: string;
  size: number;
};

export type CommunityPostPrefill = {
  title: string;
  body: string;
  images: RedactedImage[];
  tags: string[];
  sourceAssessmentId: string;
};

/**
 * Generates a prefilled community post from an assessment result.
 * Redacts images and strips sensitive metadata for privacy.
 *
 * @param options - Options object containing assessment result, ID, plant context, and captured photos
 * @returns Prefilled post data with redacted images
 */
type GeneratePrefillOptions = {
  assessment: AssessmentResult;
  assessmentId: string;
  plantContext: AssessmentPlantContext;
  capturedPhotos?: CapturedPhoto[];
};

export async function generateCommunityPostPrefill({
  assessment,
  assessmentId,
  plantContext,
  capturedPhotos,
}: GeneratePrefillOptions): Promise<CommunityPostPrefill> {
  // Redact all images (strip EXIF, re-encode with random filenames)
  const imagesToRedact = (capturedPhotos ?? assessment.perImage).map((img) => ({
    id: img.id,
    uri: img.uri,
  }));

  const redactedImages = await Promise.all(
    imagesToRedact.map(async (img) => {
      const redacted = await redactAssessmentForCommunity(
        img.uri,
        plantContext
      );

      // Get file size if available
      let size = 0;
      try {
        const blob = await fetch(redacted.redactedImageUri).then((r) =>
          r.blob()
        );
        size = blob.size ?? 0;
      } catch {
        // Size unavailable, use 0
      }

      return {
        uri: redacted.redactedImageUri,
        filename: redacted.anonymousFilename,
        size,
      };
    })
  );

  // Generate title
  const title = generatePostTitle(assessment);

  // Generate body with sanitized context
  const body = generatePostBody(assessment, plantContext);

  // Generate tags based on assessment class category
  const tags = generatePostTags(assessment);

  return {
    title,
    body,
    images: redactedImages,
    tags,
    sourceAssessmentId: assessmentId,
  };
}

/**
 * Generates a post title based on assessment result
 */
function generatePostTitle(assessment: AssessmentResult): string {
  const isUncertain =
    assessment.calibratedConfidence < 0.7 || assessment.topClass.isOod;

  if (isUncertain) {
    return 'Need help identifying plant issue';
  }

  // For more confident results, include the class name
  return `Looking for advice on ${assessment.topClass.name.toLowerCase()}`;
}

/**
 * Generates post body with assessment context.
 * Strips sensitive metadata while keeping useful plant information.
 */
function generatePostBody(
  assessment: AssessmentResult,
  plantContext: AssessmentPlantContext
): string {
  const parts: string[] = [];

  // Add AI assessment context
  const confidencePercent = Math.round(assessment.calibratedConfidence * 100);
  parts.push(
    `I used the AI assessment tool and got "${assessment.topClass.name}" with ${confidencePercent}% confidence. Looking for a second opinion.`
  );

  // Add plant details if available (sanitized)
  const plantDetails: string[] = [];

  if (plantContext.metadata?.stage) {
    plantDetails.push(`Stage: ${plantContext.metadata.stage}`);
  }

  if (plantContext.metadata?.setup_type) {
    plantDetails.push(`Setup: ${plantContext.metadata.setup_type}`);
  }

  // Only include strain if user explicitly provided it (no PII)
  if (
    plantContext.metadata?.strain &&
    typeof plantContext.metadata.strain === 'string'
  ) {
    plantDetails.push(`Strain: ${plantContext.metadata.strain}`);
  }

  if (plantDetails.length > 0) {
    parts.push(`\nPlant details: ${plantDetails.join(', ')}`);
  }

  // Add call to action
  parts.push('\nAny advice would be appreciated!');

  return parts.join('\n');
}

/**
 * Generates tags based on assessment class category
 */
function generatePostTags(assessment: AssessmentResult): string[] {
  const tags: string[] = ['help-needed', 'ai-assessment'];

  // Add category-specific tag
  const categoryTag = `${assessment.topClass.category}-issue`;
  tags.push(categoryTag);

  // Add specific class tag if not OOD
  if (!assessment.topClass.isOod) {
    const classTag = assessment.topClass.id.replace(/_/g, '-');
    tags.push(classTag);
  }

  return tags;
}

/**
 * Validates that post prefill data is ready for submission
 */
export function validatePostPrefill(prefill: CommunityPostPrefill): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!prefill.title || prefill.title.length < 10) {
    errors.push('Title must be at least 10 characters');
  }

  if (!prefill.body || prefill.body.length < 50) {
    errors.push('Body must be at least 50 characters');
  }

  if (prefill.images.length === 0) {
    errors.push('At least one image is required');
  }

  if (prefill.images.length > 3) {
    errors.push('Maximum 3 images allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
