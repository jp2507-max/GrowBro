import * as FileSystem from 'expo-file-system';

import type { ModelInfo } from '@/types/assessment';

import { getModelPaths, isValidModelVersion } from './model-config';

/**
 * Load model metadata from disk and return parsed ModelInfo or null
 */
export async function loadModelMetadata(): Promise<ModelInfo | null> {
  const { metadataPath } = await getModelPaths();

  try {
    const fileInfo = await FileSystem.getInfoAsync(metadataPath);
    if (!fileInfo.exists) {
      console.warn('[model-metadata] Model metadata not found');
      return null;
    }

    const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
    const metadata = JSON.parse(metadataContent) as ModelInfo;

    // Validate version format
    if (!isValidModelVersion(metadata.version)) {
      throw new Error(`Invalid model version format: ${metadata.version}`);
    }

    return metadata;
  } catch (error) {
    console.error('[model-metadata] Failed to load model metadata:', error);
    return null;
  }
}

/**
 * Save model metadata to disk. Returns the saved metadata on success.
 */
export async function saveModelMetadata(
  metadata: ModelInfo
): Promise<ModelInfo> {
  const { metadataPath } = await getModelPaths();

  try {
    await FileSystem.writeAsStringAsync(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );
    return metadata;
  } catch (error) {
    console.error('[model-metadata] Failed to save model metadata:', error);
    throw error;
  }
}
