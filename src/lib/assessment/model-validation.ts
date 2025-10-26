import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system';

import { getModelPaths, MODEL_CONFIG } from './model-config';

const CHUNK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function validateModelChecksum(
  expectedChecksum?: string
): Promise<{ valid: boolean; actualChecksum: string }> {
  const { modelPath, checksumsPath } = await getModelPaths();

  try {
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    if (!fileInfo.exists || typeof fileInfo.size !== 'number') {
      throw new Error('Model file not found or size unavailable');
    }

    const hasher = CryptoJS.algo.SHA256.create();
    let offset = 0;

    while (offset < fileInfo.size) {
      const length = Math.min(CHUNK_SIZE_BYTES, fileInfo.size - offset);

      const chunk = await FileSystem.readAsStringAsync(modelPath, {
        encoding: 'base64',
        position: offset,
        length,
      });

      if (!chunk) {
        throw new Error('Failed to read model chunk for checksum');
      }

      hasher.update(CryptoJS.enc.Base64.parse(chunk));
      offset += length;
    }

    const actualChecksum = hasher.finalize().toString(CryptoJS.enc.Hex);

    // If no expected checksum provided, try to load from checksums file
    let checksumToValidate = expectedChecksum;
    if (!checksumToValidate) {
      const checksumsInfo = await FileSystem.getInfoAsync(checksumsPath);
      if (checksumsInfo.exists) {
        const checksumsContent =
          await FileSystem.readAsStringAsync(checksumsPath);
        const checksums = JSON.parse(checksumsContent);
        checksumToValidate =
          checksums[MODEL_CONFIG.MODEL_FILENAME] || checksums.model;
      }
    }

    const valid = checksumToValidate
      ? actualChecksum === checksumToValidate
      : false;

    return { valid, actualChecksum };
  } catch (error) {
    console.error('[model-validation] Checksum validation failed:', error);
    return { valid: false, actualChecksum: '' };
  }
}

export async function getModelSize(): Promise<number> {
  const { modelPath } = await getModelPaths();

  try {
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    if (!fileInfo.exists) {
      return 0;
    }

    return fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
  } catch (error) {
    console.error('[model-validation] Failed to get model size:', error);
    return 0;
  }
}

export async function validateModelSize(): Promise<boolean> {
  const sizeInMB = await getModelSize();
  return sizeInMB > 0 && sizeInMB <= MODEL_CONFIG.MAX_MODEL_SIZE_MB;
}
