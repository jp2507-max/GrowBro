import HmacSHA256 from 'crypto-js/hmac-sha256';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { imageCacheManager } from '@/lib/assessment/image-cache-manager';

// Type-safe interface for FileSystem with proper null handling
interface SafeFileSystem {
  documentDirectory: string | null | undefined;
  getInfoAsync: typeof FileSystem.getInfoAsync;
  makeDirectoryAsync: typeof FileSystem.makeDirectoryAsync;
  readDirectoryAsync: typeof FileSystem.readDirectoryAsync;
  readAsStringAsync: typeof FileSystem.readAsStringAsync;
  copyAsync: typeof FileSystem.copyAsync;
  deleteAsync: typeof FileSystem.deleteAsync;
}

const safeFileSystem = FileSystem as unknown as SafeFileSystem;

function getAssessmentDir(): string {
  if (!safeFileSystem.documentDirectory) {
    throw new Error('Document directory is not available');
  }
  return `${safeFileSystem.documentDirectory}assessments/`;
}

const SECRET_KEY = 'assessment_filename_secret';

/**
 * Get or create device secret for HMAC-based filename generation
 * Stored securely in device keychain/keystore
 */
async function getOrCreateDeviceSecret(): Promise<string> {
  try {
    let secret = await SecureStore.getItemAsync(SECRET_KEY);

    if (!secret) {
      // Generate 32-byte random secret
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      secret = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await SecureStore.setItemAsync(SECRET_KEY, secret);
    }

    return secret;
  } catch (error) {
    console.error('Failed to get/create device secret:', error);
    throw new Error('Failed to initialize secure storage');
  }
}

/**
 * Compute integrity SHA-256 hash of image bytes (unsalted)
 * Used for verification and local deduplication only
 */
export async function computeIntegritySha256(
  imageUri: string
): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64' as const,
    });
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );
    return digest;
  } catch (error) {
    console.error('Failed to compute integrity hash:', error);
    throw new Error('Failed to compute integrity hash');
  }
}

/**
 * Compute HMAC-SHA256 filename key using device secret
 * Used for content-addressable filenames to prevent cross-user correlation
 */
export async function computeFilenameKey(imageUri: string): Promise<string> {
  try {
    const secret = await getOrCreateDeviceSecret();
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64' as const,
    });

    // Compute HMAC-SHA256(secret, imageBytes)
    const hmac = HmacSHA256(base64, secret);
    return hmac.toString();
  } catch (error) {
    console.error('Failed to compute filename key:', error);
    throw new Error('Failed to compute filename key');
  }
}

/**
 * Store image with content-addressable filename
 * Returns both the filename key and integrity hash
 */
export async function storeImage(
  imageUri: string,
  assessmentId: string,
  createdAt: number = Date.now()
): Promise<{
  filenameKey: string;
  integritySha256: string;
  storedUri: string;
}> {
  try {
    // Ensure assessment directory exists
    const ASSESSMENT_DIR = getAssessmentDir();
    const assessmentDir = `${ASSESSMENT_DIR}${assessmentId}/`;
    await FileSystem.makeDirectoryAsync(assessmentDir, { intermediates: true });

    // Compute both hashes
    const [filenameKey, integritySha256] = await Promise.all([
      computeFilenameKey(imageUri),
      computeIntegritySha256(imageUri),
    ]);

    // Store with filename key
    const storedUri = `${assessmentDir}${filenameKey}.jpg`;
    await FileSystem.copyAsync({
      from: imageUri,
      to: storedUri,
    });

    // Get file size and add to cache
    const info = await FileSystem.getInfoAsync(storedUri);
    const size = info.exists && 'size' in info ? info.size : 0;
    await imageCacheManager.add({
      uri: storedUri,
      size,
      assessmentId,
      createdAt,
    });

    return { filenameKey, integritySha256, storedUri };
  } catch (error) {
    console.error('Failed to store image:', error);
    throw new Error('Failed to store image');
  }
}

/**
 * Store thumbnail with content-addressable filename
 */
export async function storeThumbnail(params: {
  thumbnailUri: string;
  assessmentId: string;
  filenameKey: string;
  createdAt?: number;
}): Promise<string> {
  const {
    thumbnailUri,
    assessmentId,
    filenameKey,
    createdAt = Date.now(),
  } = params;
  try {
    const ASSESSMENT_DIR = getAssessmentDir();
    const assessmentDir = `${ASSESSMENT_DIR}${assessmentId}/`;
    await FileSystem.makeDirectoryAsync(assessmentDir, { intermediates: true });

    const storedUri = `${assessmentDir}${filenameKey}_thumb.jpg`;
    await FileSystem.copyAsync({
      from: thumbnailUri,
      to: storedUri,
    });

    // Get file size and add to cache
    const info = await FileSystem.getInfoAsync(storedUri);
    const size = info.exists && 'size' in info ? info.size : 0;
    await imageCacheManager.add({
      uri: storedUri,
      size,
      assessmentId,
      createdAt,
    });

    return storedUri;
  } catch (error) {
    console.error('Failed to store thumbnail:', error);
    throw new Error('Failed to store thumbnail');
  }
}

/**
 * Delete assessment images and thumbnails
 */
export async function deleteAssessmentImages(
  assessmentId: string
): Promise<void> {
  try {
    // Remove from cache first
    await imageCacheManager.removeAssessment(assessmentId);

    const ASSESSMENT_DIR = getAssessmentDir();
    const assessmentDir = `${ASSESSMENT_DIR}${assessmentId}/`;
    const info = await FileSystem.getInfoAsync(assessmentDir);

    if (info.exists) {
      await FileSystem.deleteAsync(assessmentDir, { idempotent: true });
    }
  } catch (error) {
    console.error('Failed to delete assessment images:', error);
    // Don't throw - deletion should be idempotent
  }
}

/**
 * Get total storage used by assessments
 */
export async function getAssessmentStorageSize(): Promise<number> {
  try {
    const ASSESSMENT_DIR = getAssessmentDir();
    const info = await FileSystem.getInfoAsync(ASSESSMENT_DIR);
    if (!info.exists) return 0;

    // Recursively calculate directory size
    let totalSize = 0;
    const files = await FileSystem.readDirectoryAsync(ASSESSMENT_DIR);

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(
        `${ASSESSMENT_DIR}${file}`
      );
      if (fileInfo.exists && 'size' in fileInfo) {
        totalSize += fileInfo.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
}

/**
 * Clean up old assessment images (LRU cache management)
 * Deletes assessments older than retentionDays
 */
export async function cleanupOldAssessments(
  retentionDays: number = 90
): Promise<number> {
  try {
    const ASSESSMENT_DIR = getAssessmentDir();
    const info = await FileSystem.getInfoAsync(ASSESSMENT_DIR);
    if (!info.exists) return 0;

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const assessments = await FileSystem.readDirectoryAsync(ASSESSMENT_DIR);

    for (const assessmentId of assessments) {
      const assessmentDir = `${ASSESSMENT_DIR}${assessmentId}/`;
      const dirInfo = await FileSystem.getInfoAsync(assessmentDir);

      if (dirInfo.exists && 'modificationTime' in dirInfo) {
        if (dirInfo.modificationTime * 1000 < cutoffTime) {
          await FileSystem.deleteAsync(assessmentDir, { idempotent: true });
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old assessments:', error);
    return 0;
  }
}
