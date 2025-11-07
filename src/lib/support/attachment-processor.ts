import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import type { Attachment } from '@/types/support';

const MAX_TOTAL_SIZE_MB = 10;
const MAX_ATTACHMENT_COUNT = 3;
const TARGET_WIDTH = 1920;
const COMPRESSION_QUALITY = 0.8;

export interface ProcessResult {
  success: boolean;
  attachments?: Attachment[];
  error?: string;
}

/**
 * Process image attachments: compress and strip EXIF data
 */
export async function processAttachments(
  imageUris: string[]
): Promise<ProcessResult> {
  if (imageUris.length === 0) {
    return { success: true, attachments: [] };
  }

  if (imageUris.length > MAX_ATTACHMENT_COUNT) {
    return {
      success: false,
      error: `Maximum ${MAX_ATTACHMENT_COUNT} attachments allowed`,
    };
  }

  const attachments: Attachment[] = [];
  let totalSizeBytes = 0;

  try {
    for (const uri of imageUris) {
      const processed = await processImage(uri);

      if (!processed) {
        return {
          success: false,
          error: 'Failed to process image',
        };
      }

      totalSizeBytes += processed.sizeBytes;

      // Check total size limit
      if (totalSizeBytes > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        return {
          success: false,
          error: `Total attachment size exceeds ${MAX_TOTAL_SIZE_MB}MB`,
        };
      }

      attachments.push(processed);
    }

    return { success: true, attachments };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single image: compress and strip EXIF
 */
async function processImage(uri: string): Promise<Attachment | null> {
  try {
    // Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return null;
    }

    // Manipulate image to strip EXIF and compress
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: TARGET_WIDTH } }],
      {
        compress: COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Get processed file info
    const processedInfo = await FileSystem.getInfoAsync(manipulated.uri);
    const sizeBytes = processedInfo.exists ? processedInfo.size || 0 : 0;

    // Extract filename from URI robustly
    let fileName = 'attachment.jpg';
    try {
      // Try using the URL API for standard URIs
      const url = new URL(uri);
      fileName = url.pathname.split('/').pop() || fileName;
    } catch {
      // Fallback for non-standard/file URIs
      const match = uri.match(/([^\/\\]+)$/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    return {
      localUri: manipulated.uri,
      fileName,
      mimeType: 'image/jpeg',
      sizeBytes,
      exifStripped: true,
    };
  } catch (error) {
    console.error('Failed to process image:', error);
    return null;
  }
}

/**
 * Check if image contains EXIF location data
 *
 * @param _uri - Image URI (currently unused, reserved for future EXIF reading implementation)
 * @returns Promise<boolean> - Always returns false as EXIF reading is not implemented
 *
 * @todo Implement actual EXIF location data detection when expo-image-manipulator
 * or alternative libraries provide EXIF access. Currently returns false as a
 * security precaution to ensure location data is stripped.
 */
export async function hasLocationData(_uri: string): Promise<boolean> {
  // Note: expo-image-manipulator doesn't expose EXIF reading
  // This is a placeholder for a more robust implementation
  // In production, consider using expo-media-library or react-native-image-picker
  // which provide EXIF data access

  // For now, we always strip EXIF as a precaution
  return false;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Calculate total size of attachments
 */
export function calculateTotalSize(attachments: Attachment[]): number {
  return attachments.reduce(
    (total, attachment) => total + attachment.sizeBytes,
    0
  );
}

/**
 * Validate attachment size limits
 */
export function validateAttachmentSize(attachments: Attachment[]): {
  isValid: boolean;
  error?: string;
} {
  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    return {
      isValid: false,
      error: `Maximum ${MAX_ATTACHMENT_COUNT} attachments allowed`,
    };
  }

  const totalSize = calculateTotalSize(attachments);
  const maxSizeBytes = MAX_TOTAL_SIZE_MB * 1024 * 1024;

  if (totalSize > maxSizeBytes) {
    return {
      isValid: false,
      error: `Total size exceeds ${MAX_TOTAL_SIZE_MB}MB (current: ${formatFileSize(totalSize)})`,
    };
  }

  return { isValid: true };
}
