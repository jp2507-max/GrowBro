/**
 * Image Queue Management
 * Handles image storage on filesystem with URI tracking
 * Ensures text data sync is never blocked by image uploads
 */

// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Get the document directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 */
function getDocumentDirectoryUri(): string {
  const uri = Paths?.document?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Document directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return uri;
}

/**
 * Image queue item for upload
 */
type ImageQueueItem = {
  id: string;
  localUri: string;
  remoteUri?: string;
  table: string;
  recordId: string;
  uploadedAt?: number;
  retries: number;
};

/**
 * Image storage configuration
 */
const getImageStorageDir = (): string => {
  return `${getDocumentDirectoryUri()}images/`;
};
const IMAGE_STORAGE_DIR = getImageStorageDir();
const MAX_IMAGE_RETRIES = 3;

/**
 * Ensure image storage directory exists
 */
async function ensureImageDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_STORAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_STORAGE_DIR, {
      intermediates: true,
    });
  }
}

/**
 * Save image to filesystem and return local URI
 *
 * @param imageUri - Source image URI (can be camera, gallery, or temp)
 * @param recordId - ID of the record this image belongs to
 * @returns Local filesystem URI for the saved image
 */
export async function saveImageToFilesystem(
  imageUri: string,
  recordId: string
): Promise<string> {
  await ensureImageDirectory();

  // Generate unique filename
  const timestamp = Date.now();
  const extension = imageUri.split('.').pop() || 'jpg';
  const filename = `${recordId}_${timestamp}.${extension}`;
  const localUri = `${IMAGE_STORAGE_DIR}${filename}`;

  // Copy image to app's document directory
  await FileSystem.copyAsync({
    from: imageUri,
    to: localUri,
  });

  return localUri;
}

/**
 * Delete image from filesystem
 *
 * @param localUri - Local filesystem URI to delete
 */
export async function deleteImageFromFilesystem(
  localUri: string
): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  } catch (error) {
    console.warn('[ImageQueue] Failed to delete image:', error);
  }
}

/**
 * ImageQueue class for managing image uploads separate from text sync
 */
export class ImageQueue {
  private queue: Map<string, ImageQueueItem>;
  private uploading: boolean;

  constructor() {
    this.queue = new Map();
    this.uploading = false;
  }

  /**
   * Add image to upload queue
   *
   * @param localUri - Local filesystem URI
   * @param table - Database table name
   * @param recordId - Record ID that owns this image
   * @returns Queue item ID
   */
  addToQueue(localUri: string, table: string, recordId: string): string {
    const id = `${table}_${recordId}_${Date.now()}`;

    this.queue.set(id, {
      id,
      localUri,
      table,
      recordId,
      retries: 0,
    });

    return id;
  }

  /**
   * Get pending upload count
   */
  getPendingCount(): number {
    return this.queue.size;
  }

  /**
   * Process image upload queue
   *
   * @param uploadFn - Function to upload image and return remote URI
   */
  async processQueue(
    uploadFn: (localUri: string) => Promise<string>
  ): Promise<void> {
    if (this.uploading) return;

    this.uploading = true;

    try {
      for (const [id, item] of this.queue.entries()) {
        try {
          // Upload image
          const remoteUri = await uploadFn(item.localUri);

          // Update queue item
          item.remoteUri = remoteUri;
          item.uploadedAt = Date.now();

          // Remove from queue
          this.queue.delete(id);

          // Optionally delete local copy after successful upload
          // await deleteImageFromFilesystem(item.localUri);
        } catch (error) {
          console.warn(`[ImageQueue] Upload failed for ${id}:`, error);

          // Increment retry count
          item.retries++;

          // Remove if max retries exceeded
          if (item.retries >= MAX_IMAGE_RETRIES) {
            console.error(
              `[ImageQueue] Max retries exceeded for ${id}, removing from queue`
            );
            this.queue.delete(id);
          }
        }
      }
    } finally {
      this.uploading = false;
    }
  }

  /**
   * Clear all queued items
   */
  clearQueue(): void {
    this.queue.clear();
  }

  /**
   * Get queue items for specific table/record
   *
   * @param table - Table name
   * @param recordId - Record ID
   * @returns Array of queue items
   */
  getItemsForRecord(table: string, recordId: string): ImageQueueItem[] {
    return Array.from(this.queue.values()).filter(
      (item) => item.table === table && item.recordId === recordId
    );
  }
}

/**
 * Singleton image queue instance
 */
export const imageQueue = new ImageQueue();
