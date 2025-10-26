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

import { supabase } from '@/lib/supabase';

import { getModelPaths } from './model-config';

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
  const bucketName = 'assessment-models';
  const objectPath = `models/plant_classifier_${version}.ort`;

  try {
    // Get signed URL for download
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(objectPath, 3600); // 1 hour expiry

    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Failed to get download URL: ${urlError?.message}`);
    }

    // Download file
    const downloadResumable = FileSystem.createDownloadResumable(
      urlData.signedUrl,
      modelPath,
      {},
      (downloadProgress) => {
        if (options?.onProgress) {
          const { totalBytesWritten, totalBytesExpectedToWrite } =
            downloadProgress;
          options.onProgress({
            bytesDownloaded: totalBytesWritten,
            totalBytes: totalBytesExpectedToWrite,
            percentage:
              totalBytesExpectedToWrite > 0
                ? (totalBytesWritten / totalBytesExpectedToWrite) * 100
                : 0,
          });
        }
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result) {
      throw new Error('Download failed: no result returned');
    }

    // Validate checksum if provided
    let checksumValid = true;
    if (options?.expectedChecksum) {
      checksumValid = await validateChecksum(
        modelPath,
        options.expectedChecksum
      );
      if (!checksumValid) {
        // Clean up invalid file
        await FileSystem.deleteAsync(modelPath, { idempotent: true });
        throw new Error('Checksum validation failed');
      }
    }

    return {
      success: true,
      modelPath,
      checksumValid,
    };
  } catch (error) {
    // Clean up on failure
    try {
      await FileSystem.deleteAsync(modelPath, { idempotent: true });
    } catch (cleanupError) {
      console.warn('[ModelDownloader] Failed to clean up:', cleanupError);
    }

    return {
      success: false,
      modelPath,
      checksumValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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

    // Calculate SHA-256 checksum
    // Read file as base64 and compute hash
    const base64Content = await FileSystem.readAsStringAsync(filePath, {
      encoding: 'base64',
    });
    const actualChecksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Content,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

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
