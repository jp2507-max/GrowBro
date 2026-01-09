/**
 * File validation utilities for media uploads
 *
 * Requirements:
 * - 5.4: Guard against large originals to prevent memory issues
 */

import * as FileSystem from 'expo-file-system/legacy';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sizeBytes?: number;
}

/**
 * Validate file size before processing
 * Prevents memory issues on low-end devices by rejecting oversized images
 *
 * @param uri - File URI to validate
 * @returns Validation result with error message if invalid
 */
export async function validateFileSize(
  uri: string
): Promise<FileValidationResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (!fileInfo.exists) {
      return {
        isValid: false,
        error: 'File does not exist',
      };
    }

    const sizeBytes = fileInfo.size ?? 0;

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
      const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
      return {
        isValid: false,
        error: `File size (${sizeMB}MB) exceeds maximum allowed size (${maxMB}MB)`,
        sizeBytes,
      };
    }

    return {
      isValid: true,
      sizeBytes,
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : 'Failed to validate file size',
    };
  }
}

/**
 * Get maximum allowed file size in bytes
 */
export function getMaxFileSizeBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}
