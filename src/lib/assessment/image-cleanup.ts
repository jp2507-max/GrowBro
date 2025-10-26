import * as FileSystem from 'expo-file-system';

import {
  getAssessmentDir,
  sanitizePathSegment,
} from '@/lib/assessment/assessment-paths';
import { imageCacheManager } from '@/lib/assessment/image-cache-manager';

async function computeDirSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  const entries = await FileSystem.readDirectoryAsync(dirPath);

  for (const entry of entries) {
    const entryPath = `${dirPath}${entry}`;
    const info = await FileSystem.getInfoAsync(entryPath);

    if (info.exists) {
      if (info.isDirectory) {
        totalSize += await computeDirSize(`${entryPath}/`);
      } else if ('size' in info) {
        totalSize += info.size;
      }
    }
  }

  return totalSize;
}

export async function deleteAssessmentImages(
  assessmentId: string
): Promise<void> {
  try {
    await imageCacheManager.removeAssessment(assessmentId);

    const assessmentsRoot = getAssessmentDir();
    const assessmentDir = `${assessmentsRoot}${sanitizePathSegment(assessmentId)}/`;
    const info = await FileSystem.getInfoAsync(assessmentDir);

    if (info.exists) {
      await FileSystem.deleteAsync(assessmentDir, { idempotent: true });
    }
  } catch (error) {
    console.error('Failed to delete assessment images:', error);
  }
}

export async function getAssessmentStorageSize(): Promise<number> {
  try {
    const assessmentsRoot = getAssessmentDir();
    const info = await FileSystem.getInfoAsync(assessmentsRoot);

    if (!info.exists) {
      return 0;
    }

    return await computeDirSize(assessmentsRoot);
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
}

export async function cleanupOldAssessments(
  retentionDays: number = 90
): Promise<number> {
  try {
    const assessmentsRoot = getAssessmentDir();
    const info = await FileSystem.getInfoAsync(assessmentsRoot);

    if (!info.exists) {
      return 0;
    }

    const cutoffTime = Math.floor(
      (Date.now() - retentionDays * 24 * 60 * 60 * 1000) / 1000
    );
    let deletedCount = 0;

    const assessments = await FileSystem.readDirectoryAsync(assessmentsRoot);

    for (const assessmentId of assessments) {
      const assessmentDir = `${assessmentsRoot}${sanitizePathSegment(assessmentId)}/`;
      const dirInfo = await FileSystem.getInfoAsync(assessmentDir);

      if (
        dirInfo.exists &&
        typeof dirInfo.modificationTime === 'number' &&
        !Number.isNaN(dirInfo.modificationTime) &&
        dirInfo.modificationTime < cutoffTime
      ) {
        await FileSystem.deleteAsync(assessmentDir, { idempotent: true });
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old assessments:', error);
    return 0;
  }
}
