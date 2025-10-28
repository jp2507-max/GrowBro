/**
 * Model Downloader
 *
 * Downloads models from Supabase Storage with:
 * - Checksum validation
 * - Progress tracking
 * - Resume capability
 * - Automatic cleanup on failure
 *
 * Requirements:
 * - 10.1: Deliver quantized ONNX models with checksum validation
 * - 10.2: Model caching and efficient storage
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { FileSystemDownloadResult } from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

import { getModelPaths } from './model-config';

const MODEL_BUCKET = 'assessment-models';
const DOWNLOAD_URL_EXPIRY_SECONDS = 3600;

export type DownloadProgress = {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
};

export type DownloadResult = {
  success: boolean;
  modelPath: string;
  checksumValid: boolean;
  error?: string;
};

/**
 * Download model from Supabase Storage
 */
export async function downloadModelFromStorage(
  version: string,
  options?: {
    expectedChecksum?: string;
    onProgress?: (progress: DownloadProgress) => void;
  }
): Promise<DownloadResult> {
  const { modelPath } = await getModelPaths();
  const objectPath = buildModelObjectPath(version);

  try {
    const signedUrl = await createModelSignedUrl(objectPath);
    await ensureDestinationDirectory(modelPath);

    const downloadResult = await downloadModelFile(
      signedUrl,
      modelPath,
      options?.onProgress
    );
    validateDownloadResponse(downloadResult);

    const checksumValid = await validateChecksumIfNeeded(
      modelPath,
      options?.expectedChecksum
    );

    return {
      success: true,
      modelPath,
      checksumValid,
    };
  } catch (error) {
    await cleanupCorruptDownload(modelPath);

    return {
      success: false,
      modelPath,
      checksumValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function buildModelObjectPath(version: string): string {
  return `models/plant_classifier_${version}.ort`;
}

async function createModelSignedUrl(objectPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MODEL_BUCKET)
    .createSignedUrl(objectPath, DOWNLOAD_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to get download URL: ${error?.message}`);
  }

  return data.signedUrl;
}

async function ensureDestinationDirectory(modelPath: string): Promise<void> {
  const directoryPath = modelPath.substring(0, modelPath.lastIndexOf('/'));
  if (!directoryPath) {
    return;
  }

  try {
    await FileSystem.makeDirectoryAsync(directoryPath, {
      intermediates: true,
    });
  } catch (error) {
    console.warn('[ModelDownloader] Failed to create directory:', error);
  }
}

async function downloadModelFile(
  signedUrl: string,
  modelPath: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<FileSystemDownloadResult | undefined> {
  const downloadResumable = FileSystem.createDownloadResumable(
    signedUrl,
    modelPath,
    {},
    (progress) => {
      if (!onProgress) {
        return;
      }

      const { totalBytesExpectedToWrite, totalBytesWritten } = progress;
      onProgress({
        bytesDownloaded: totalBytesWritten,
        totalBytes: totalBytesExpectedToWrite,
        percentage:
          totalBytesExpectedToWrite > 0
            ? (totalBytesWritten / totalBytesExpectedToWrite) * 100
            : 0,
      });
    }
  );

  return downloadResumable.downloadAsync();
}

function validateDownloadResponse(
  result: FileSystemDownloadResult | undefined
): void {
  if (!result) {
    throw new Error('Download failed: no result returned');
  }

  if (result.status >= 200 && result.status < 300) {
    return;
  }

  const statusText =
    result.status === 403
      ? 'Forbidden'
      : result.status === 404
        ? 'Not Found'
        : result.status === 500
          ? 'Internal Server Error'
          : 'HTTP Error';
  const contentType = result.headers?.['content-type'] || 'unknown';
  const contentLength = result.headers?.['content-length'] || 'unknown';

  throw new Error(
    `Download failed with HTTP ${result.status} ${statusText}. ` +
      `Content-Type: ${contentType}, Content-Length: ${contentLength}`
  );
}

async function validateChecksumIfNeeded(
  modelPath: string,
  expectedChecksum?: string
): Promise<boolean> {
  if (!expectedChecksum) {
    return true;
  }

  const checksumValid = await validateChecksum(modelPath, expectedChecksum);
  if (!checksumValid) {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
    throw new Error('Checksum validation failed');
  }

  return true;
}

async function cleanupCorruptDownload(modelPath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
  } catch (error) {
    console.warn('[ModelDownloader] Failed to clean up:', error);
  }
}

/**
 * Download model metadata from Supabase Storage
 */
export async function downloadModelMetadata(version: string): Promise<{
  success: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
}> {
  const bucketName = 'assessment-models';
  const objectPath = `models/plant_classifier_${version}.json`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(objectPath);

    if (error || !data) {
      throw new Error(`Failed to download metadata: ${error?.message}`);
    }

    const text = await data.text();
    const metadata = JSON.parse(text);

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate file checksum against expected SHA-256 hash
 */
async function validateChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return false;
    }

    // Calculate SHA-256 checksum over raw file bytes
    // Read as base64 → decode to bytes → digest bytes
    const base64Content = await FileSystem.readAsStringAsync(filePath, {
      encoding: 'base64',
    });
    const { toByteArray } = await import('react-native-quick-base64');
    const rawBytes = toByteArray(base64Content);
    const bytes = Uint8Array.from(rawBytes);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    const digestBuffer = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      arrayBuffer
    );
    const actualChecksum = Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
  } catch (error) {
    console.error('[ModelDownloader] Checksum validation failed:', error);
    return false;
  }
}

/**
 * Get model file size from Supabase Storage
 */
export async function getModelSize(version: string): Promise<number | null> {
  const bucketName = 'assessment-models';

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('models', {
        search: `plant_classifier_${version}.ort`,
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Size is in bytes, convert to MB
    const sizeBytes = data[0].metadata?.size ?? 0;
    return sizeBytes / (1024 * 1024);
  } catch (error) {
    console.error('[ModelDownloader] Failed to get model size:', error);
    return null;
  }
}

/**
 * Check if model exists in Supabase Storage
 */
export async function checkModelExists(version: string): Promise<boolean> {
  const bucketName = 'assessment-models';

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('models', {
        search: `plant_classifier_${version}.ort`,
      });

    return !error && data && data.length > 0;
  } catch (error) {
    console.error('[ModelDownloader] Failed to check model existence:', error);
    return false;
  }
}
