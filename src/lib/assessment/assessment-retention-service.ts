import * as FileSystem from 'expo-file-system';

import { appendAudit } from '@/lib/privacy/audit-log';
import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentPlantContext } from '@/types/assessment';

// Type-safe interface for FileSystem module with proper null handling
interface SafeFileSystem {
  documentDirectory: string | null | undefined;
  cacheDirectory: string | null | undefined;
  getInfoAsync: typeof FileSystem.getInfoAsync;
  deleteAsync: typeof FileSystem.deleteAsync;
}

const safeFileSystem = FileSystem as unknown as SafeFileSystem;

export type AssessmentRetentionPolicy = {
  images: number; // days, opt-in only
  metrics: number; // days, anonymized
  records: number; // days, local only without consent
};

export const DEFAULT_ASSESSMENT_RETENTION: AssessmentRetentionPolicy = {
  images: 90, // Raw images ≤90 days (opt-in only)
  metrics: 365, // Derived metrics 12 months
  records: 1825, // 5 years local only without consent
};

export type RetentionResult = {
  imagesDeleted: number;
  recordsAnonymized: number;
  recordsDeleted: number;
  errors: string[];
};

/**
 * Enforce retention policy for assessment data
 * - Delete images older than 90 days (only if consented_for_training)
 * - Anonymize metrics older than 365 days
 * - Delete records older than 1825 days
 */
type RetentionCutoffs = {
  imageCutoff: number;
  metricsCutoff: number;
  recordsCutoff: number;
};

export async function enforceAssessmentRetention(
  policy: AssessmentRetentionPolicy = DEFAULT_ASSESSMENT_RETENTION
): Promise<RetentionResult> {
  const result: RetentionResult = {
    imagesDeleted: 0,
    recordsAnonymized: 0,
    recordsDeleted: 0,
    errors: [],
  };

  const now = Date.now();
  const cutoffs = calculateRetentionCutoffs(policy, now);

  let assessments: AssessmentModel[] = [];
  try {
    assessments = (await database
      .get('assessments')
      .query()
      .fetch()) as AssessmentModel[];
  } catch (error) {
    result.errors.push(
      `Retention enforcement failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }

  await deleteExpiredImages(assessments, cutoffs.imageCutoff, result);
  await anonymizeOldMetrics(assessments, cutoffs.metricsCutoff, result);
  await deleteExpiredRecords(assessments, cutoffs.recordsCutoff, result);

  try {
    await appendAudit({
      action: 'retention-delete',
      dataType: 'assessments',
      count: result.imagesDeleted + result.recordsDeleted,
      details: {
        imagesDeleted: result.imagesDeleted,
        recordsAnonymized: result.recordsAnonymized,
        recordsDeleted: result.recordsDeleted,
        errors: result.errors.length,
        timestamp: now,
      },
    });
  } catch (error) {
    result.errors.push(
      `Retention enforcement failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

function calculateRetentionCutoffs(
  policy: AssessmentRetentionPolicy,
  now: number
): RetentionCutoffs {
  const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

  return {
    imageCutoff: now - daysToMs(policy.images),
    metricsCutoff: now - daysToMs(policy.metrics),
    recordsCutoff: now - daysToMs(policy.records),
  };
}

async function deleteExpiredImages(
  assessments: AssessmentModel[],
  imageCutoff: number,
  result: RetentionResult
): Promise<void> {
  for (const assessment of assessments) {
    const createdAt = getCreatedAtMs(assessment);
    const consentedForTraining = Boolean(assessment.consentedForTraining);

    if (!consentedForTraining || createdAt >= imageCutoff) {
      continue;
    }

    try {
      const docDir =
        safeFileSystem.documentDirectory ?? safeFileSystem.cacheDirectory ?? '';
      const assessmentDir = `${docDir}assessments/${assessment.id}`;
      const dirInfo = await safeFileSystem.getInfoAsync(assessmentDir);

      if (dirInfo.exists) {
        await safeFileSystem.deleteAsync(assessmentDir, { idempotent: true });
        result.imagesDeleted++;
      }
    } catch (error) {
      result.errors.push(
        `Failed to delete images for ${assessment.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

async function anonymizeOldMetrics(
  assessments: AssessmentModel[],
  metricsCutoff: number,
  result: RetentionResult
): Promise<void> {
  for (const assessment of assessments) {
    const createdAt = getCreatedAtMs(assessment);

    if (createdAt >= metricsCutoff) {
      continue;
    }

    try {
      await database.write(async () => {
        await assessment.update((record) => {
          if (record.plantContext) {
            const context: AssessmentPlantContext & Record<string, unknown> =
              typeof record.plantContext === 'string'
                ? JSON.parse(record.plantContext)
                : record.plantContext;
            delete context.strainName;
            delete context.notes;
            delete context.customTags;
            record.plantContext = context as AssessmentPlantContext;
          }
          record.feedbackNotes = null;
        });
      });
      result.recordsAnonymized++;
    } catch (error) {
      result.errors.push(
        `Failed to anonymize ${assessment.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

async function deleteExpiredRecords(
  assessments: AssessmentModel[],
  recordsCutoff: number,
  result: RetentionResult
): Promise<void> {
  for (const assessment of assessments) {
    const createdAt = getCreatedAtMs(assessment);

    if (createdAt >= recordsCutoff) {
      continue;
    }

    try {
      await database.write(async () => {
        await assessment.markAsDeleted();
      });
      result.recordsDeleted++;
    } catch (error) {
      result.errors.push(
        `Failed to delete ${assessment.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function getCreatedAtMs(assessment: AssessmentModel): number {
  const createdAt = assessment.createdAt;
  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }
  // Handle edge case where createdAt might be a date-like object
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'getTime' in createdAt &&
    typeof (createdAt as { getTime: unknown }).getTime === 'function'
  ) {
    return (createdAt as Date).getTime();
  }
  return 0;
}

/**
 * Get count of assessments that will be affected by retention policy
 */
export async function getRetentionImpact(
  policy: AssessmentRetentionPolicy = DEFAULT_ASSESSMENT_RETENTION
): Promise<{
  imagesToDelete: number;
  recordsToAnonymize: number;
  recordsToDelete: number;
}> {
  const now = Date.now();
  const imageCutoff = now - policy.images * 24 * 60 * 60 * 1000;
  const metricsCutoff = now - policy.metrics * 24 * 60 * 60 * 1000;
  const recordsCutoff = now - policy.records * 24 * 60 * 60 * 1000;

  const assessments = (await database
    .get('assessments')
    .query()
    .fetch()) as AssessmentModel[];

  let imagesToDelete = 0;
  let recordsToAnonymize = 0;
  let recordsToDelete = 0;

  for (const assessment of assessments) {
    const createdAt = getCreatedAtMs(assessment);
    const consentedForTraining = assessment.consentedForTraining;

    if (consentedForTraining && createdAt < imageCutoff) {
      imagesToDelete++;
    }
    if (createdAt < metricsCutoff) {
      recordsToAnonymize++;
    }
    if (createdAt < recordsCutoff) {
      recordsToDelete++;
    }
  }

  return { imagesToDelete, recordsToAnonymize, recordsToDelete };
}
