import * as FileSystem from 'expo-file-system';

import type { ModelInfo, ModelLoadOptions } from '@/types/assessment';

import { getModelPaths, isValidModelVersion } from './model-config';
import { saveModelMetadata } from './model-metadata';

/**
 * Download model from remote storage (Supabase Storage)
 */
export async function downloadModel(
  version: string,
  options?: ModelLoadOptions
): Promise<void> {
  if (!isValidModelVersion(version)) {
    throw new Error(`Invalid model version: ${version}`);
  }

  // Import downloader dynamically to avoid circular dependencies
  const { downloadModelFromStorage, downloadModelMetadata } = await import(
    './model-downloader'
  );

  // Download metadata first to get checksum
  const metadataResult = await downloadModelMetadata(version);
  if (!metadataResult.success || !metadataResult.metadata) {
    throw new Error(
      `Failed to download model metadata: ${metadataResult.error}`
    );
  }

  const expectedChecksum = metadataResult.metadata.checksumSha256 as
    | string
    | undefined;

  // Download model file
  const downloadResult = await downloadModelFromStorage(version, {
    expectedChecksum: options?.validateChecksum ? expectedChecksum : undefined,
  });

  if (!downloadResult.success) {
    throw new Error(`Failed to download model: ${downloadResult.error}`);
  }

  console.log(
    `[model-lifecycle] Model ${version} downloaded successfully (checksum valid: ${downloadResult.checksumValid})`
  );
}

/**
 * Load model metadata from a JSON file in the model directory
 */
async function loadModelMetadataFromFile(
  modelPath: string
): Promise<Partial<ModelInfo> | null> {
  const metadataPath = modelPath.replace(/\.[^.]+$/, '.metadata.json');

  try {
    const fileInfo = await FileSystem.getInfoAsync(metadataPath);
    if (!fileInfo.exists) {
      return null;
    }

    const metadataJson = await FileSystem.readAsStringAsync(metadataPath);
    const metadata = JSON.parse(metadataJson);

    // Validate that it's a valid partial ModelInfo
    if (typeof metadata !== 'object' || metadata === null) {
      console.warn('[model-lifecycle] Invalid metadata JSON format');
      return null;
    }

    return metadata;
  } catch (error) {
    console.warn('[model-lifecycle] Failed to load metadata from file:', error);
    return null;
  }
}

/**
 * Merge and validate model metadata with defaults
 */
function mergeAndValidateMetadata(
  version: string,
  providedMetadata?: Partial<ModelInfo>,
  loadedMetadata?: Partial<ModelInfo> | null
): ModelInfo {
  // Start with loaded metadata, then override with provided metadata
  const baseMetadata = loadedMetadata || {};
  const mergedMetadata = { ...baseMetadata, ...providedMetadata };

  // Apply defaults
  const defaults: Partial<ModelInfo> = {
    version,
    lastUpdated: new Date().toISOString(),
    description: `Plant classifier model ${version}`,
    delegates: [],
  };

  const finalMetadata = { ...defaults, ...mergedMetadata };

  // Validate required fields
  if (!finalMetadata.version) {
    throw new Error('Model version is required');
  }

  if (!Array.isArray(finalMetadata.delegates)) {
    throw new Error('Model delegates must be an array');
  }

  return finalMetadata as ModelInfo;
}

/**
 * Update model to new version. Returns saved metadata.
 */
export async function updateModel(
  version: string,
  options?: ModelLoadOptions,
  metadata?: Partial<ModelInfo>
): Promise<ModelInfo> {
  if (!isValidModelVersion(version)) {
    throw new Error(`Invalid model version: ${version}`);
  }

  try {
    // Download new model
    await downloadModel(version, options);

    // Get model paths to locate potential metadata file
    const { modelPath } = await getModelPaths();

    // Try to load metadata from file if none provided
    let loadedMetadata: Partial<ModelInfo> | null = null;
    if (!metadata) {
      loadedMetadata = await loadModelMetadataFromFile(modelPath);
    }

    // Merge and validate metadata
    const finalMetadata = mergeAndValidateMetadata(
      version,
      metadata,
      loadedMetadata
    );

    const saved = await saveModelMetadata(finalMetadata);
    console.log(`[model-lifecycle] Model updated to version ${version}`);
    return saved;
  } catch (error) {
    console.error('[model-lifecycle] Model update failed:', error);
    throw error;
  }
}

/**
 * Delete model and metadata
 */
export async function deleteModel(): Promise<void> {
  const { modelPath, metadataPath, checksumsPath } = await getModelPaths();

  try {
    // Delete model file
    const modelInfo = await FileSystem.getInfoAsync(modelPath);
    if (modelInfo.exists) {
      await FileSystem.deleteAsync(modelPath);
    }

    // Delete metadata
    const metadataInfo = await FileSystem.getInfoAsync(metadataPath);
    if (metadataInfo.exists) {
      await FileSystem.deleteAsync(metadataPath);
    }

    // Delete checksums
    const checksumsInfo = await FileSystem.getInfoAsync(checksumsPath);
    if (checksumsInfo.exists) {
      await FileSystem.deleteAsync(checksumsPath);
    }

    console.log('[model-lifecycle] Model deleted');
  } catch (error) {
    console.error('[model-lifecycle] Model deletion failed:', error);
    throw error;
  }
}
