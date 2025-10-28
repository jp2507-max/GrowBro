import { Q } from '@nozbe/watermelondb';
import { Directory, Paths } from 'expo-file-system';

import { enqueueOutboxEntry } from '@/lib/outbox';
import { appendAudit } from '@/lib/privacy/audit-log';
import { database } from '@/lib/watermelon';

export type AssessmentDeletionOptions = {
  assessmentId: string;
  userId: string;
  reason?: string;
  deleteRemote?: boolean;
};

export type AssessmentDeletionResult = {
  success: boolean;
  localDeleted: boolean;
  remoteQueued: boolean;
  filesDeleted: number;
  error?: string;
};

/**
 * Sanitize assessment ID to prevent path traversal attacks
 */
function sanitizeAssessmentId(assessmentId: string): string {
  // Remove any path separators, parent directory references, and other unsafe characters
  const sanitized = assessmentId
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*\x00-\x1F]/g, ''); // Remove other unsafe characters

  if (sanitized.length === 0) {
    throw new Error(
      'Invalid assessment ID: sanitization resulted in empty string'
    );
  }

  // Validate against UUID format (common for assessment IDs)
  const uuidPattern = /^[a-zA-Z0-9_-]+$/;
  if (!uuidPattern.test(sanitized)) {
    throw new Error(`Invalid assessment ID format: ${assessmentId}`);
  }

  return sanitized;
}

/**
 * Get the file system root directory with proper type checking
 */
function getFileSystemRoot(): Directory {
  try {
    return Paths.document;
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[AssessmentDeletion]',
        'Paths.document unavailable:',
        error.message
      );
    }
  }

  try {
    return Paths.cache;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No valid file system directory available: both Paths.document and Paths.cache are unavailable'
    );
  }
}

/**
 * Delete assessment data locally (files + database records)
 */
export async function deleteAssessmentLocal(
  assessmentId: string
): Promise<{ filesDeleted: number; error?: string }> {
  let filesDeleted = 0;

  try {
    // Sanitize assessment ID to prevent path traversal
    const sanitizedId = sanitizeAssessmentId(assessmentId);

    // Get file system root with proper type checking
    const fsRoot = getFileSystemRoot();

    // Create directory reference using new FileSystem API
    const assessmentDir = new Directory(fsRoot, 'assessments', sanitizedId);

    const dirInfo = assessmentDir.info();

    if (dirInfo.exists) {
      assessmentDir.delete();
      filesDeleted = 1; // Simplified count for directory deletion
    }

    // Delete WatermelonDB records
    await database.write(async () => {
      const assessment = await database
        .get('assessments')
        .find(assessmentId)
        .catch(() => null);

      if (assessment) {
        await assessment.markAsDeleted();
      }
    });

    return { filesDeleted };
  } catch (error) {
    return {
      filesDeleted,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Cascade delete assessment data (local + queue remote deletion)
 */
export async function deleteAssessmentCascade(
  options: AssessmentDeletionOptions
): Promise<AssessmentDeletionResult> {
  const {
    assessmentId,
    userId,
    reason = 'user_initiated',
    deleteRemote = true,
  } = options;

  // Delete local data
  const localResult = await deleteAssessmentLocal(assessmentId);

  // Audit log
  await appendAudit({
    action: 'assessment-delete-local',
    details: {
      assessmentId,
      userId,
      reason,
      filesDeleted: localResult.filesDeleted,
      timestamp: Date.now(),
    },
  });

  // Queue remote deletion if requested
  let remoteQueued = false;
  if (deleteRemote && !localResult.error) {
    try {
      const outboxEntry = await enqueueOutboxEntry({
        action_type: 'delete',
        payload: {
          entity_type: 'assessment',
          entity_id: assessmentId,
          user_id: userId,
          reason,
        },
        business_key: `assessment_delete_${assessmentId}`,
        ttlSeconds: 60 * 60 * 24 * 7, // 7 days TTL
      });
      remoteQueued = outboxEntry !== undefined;
    } catch (error) {
      // If outbox queuing fails, update the result to reflect the error
      localResult.error = `Local deletion succeeded but failed to queue remote deletion: ${
        error instanceof Error ? error.message : String(error)
      }`;
      remoteQueued = false;
    }
  }

  return {
    success: !localResult.error,
    localDeleted: !localResult.error,
    remoteQueued,
    filesDeleted: localResult.filesDeleted,
    error: localResult.error,
  };
}

/**
 * Delete all assessments for a user
 */
export async function deleteAllAssessments(
  userId: string
): Promise<AssessmentDeletionResult[]> {
  const assessments = await database
    .get('assessments')
    .query(Q.where('user_id', userId))
    .fetch();

  const results: AssessmentDeletionResult[] = [];

  for (const assessment of assessments) {
    const result = await deleteAssessmentCascade({
      assessmentId: assessment.id,
      userId,
      reason: 'bulk_user_deletion',
      deleteRemote: true,
    });
    results.push(result);
  }

  return results;
}
