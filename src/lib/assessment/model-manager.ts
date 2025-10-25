import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system';

import type { ModelInfo, ModelLoadOptions } from '@/types/assessment';

import {
  getModelPaths,
  isValidModelVersion,
  MODEL_CONFIG,
} from './model-config';

/**
 * Model Manager
 * Handles model download, validation, versioning, and metadata management
 */

export class ModelManager {
  private modelInfo: ModelInfo | null = null;
  private isInitialized = false;

  /**
   * Initialize model manager and load metadata
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.ensureModelDirectory();
      await this.loadModelMetadata();
      this.isInitialized = true;
    } catch (error) {
      console.error('[ModelManager] Initialization failed:', error);
      throw new Error('Failed to initialize model manager');
    }
  }

  /**
   * Get current model information
   */
  getModelInfo(): ModelInfo | null {
    return this.modelInfo;
  }

  /**
   * Check if model is available locally
   */
  async isModelAvailable(): Promise<boolean> {
    const { modelPath } = getModelPaths();
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    return fileInfo.exists;
  }

  /**
   * Validate model file integrity using SHA-256 checksum
   */
  async validateModelChecksum(
    expectedChecksum?: string
  ): Promise<{ valid: boolean; actualChecksum: string }> {
    const { modelPath, checksumsPath } = getModelPaths();

    try {
      // Read model file
      const modelContent = await FileSystem.readAsStringAsync(modelPath, {
        encoding: 'base64',
      });

      // Compute SHA-256 hash
      const actualChecksum = CryptoJS.SHA256(
        CryptoJS.enc.Base64.parse(modelContent)
      ).toString(CryptoJS.enc.Hex);

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
      console.error('[ModelManager] Checksum validation failed:', error);
      return { valid: false, actualChecksum: '' };
    }
  }

  /**
   * Load model metadata from disk
   */
  async loadModelMetadata(): Promise<ModelInfo | null> {
    const { metadataPath } = getModelPaths();

    try {
      const fileInfo = await FileSystem.getInfoAsync(metadataPath);
      if (!fileInfo.exists) {
        console.warn('[ModelManager] Model metadata not found');
        return null;
      }

      const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
      const metadata = JSON.parse(metadataContent) as ModelInfo;

      // Validate version format
      if (!isValidModelVersion(metadata.version)) {
        throw new Error(`Invalid model version format: ${metadata.version}`);
      }

      this.modelInfo = metadata;
      return metadata;
    } catch (error) {
      console.error('[ModelManager] Failed to load model metadata:', error);
      return null;
    }
  }

  /**
   * Save model metadata to disk
   */
  async saveModelMetadata(metadata: ModelInfo): Promise<void> {
    const { metadataPath } = getModelPaths();

    try {
      await FileSystem.writeAsStringAsync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );
      this.modelInfo = metadata;
    } catch (error) {
      console.error('[ModelManager] Failed to save model metadata:', error);
      throw error;
    }
  }

  /**
   * Download model from remote storage
   * Note: This is a placeholder - actual implementation will use Supabase Storage
   */
  async downloadModel(
    version: string,
    options?: ModelLoadOptions
  ): Promise<void> {
    if (!isValidModelVersion(version)) {
      throw new Error(`Invalid model version: ${version}`);
    }

    try {
      // TODO: Implement actual download from Supabase Storage
      // For now, this is a placeholder that expects models to be bundled or pre-downloaded
      console.log(
        `[ModelManager] Model download requested for version ${version}`
      );
      console.log(
        '[ModelManager] Download from Supabase Storage not yet implemented'
      );

      // Validate checksum if requested
      if (options?.validateChecksum) {
        const validation = await this.validateModelChecksum();
        if (!validation.valid) {
          throw new Error('Model checksum validation failed after download');
        }
      }
    } catch (error) {
      console.error('[ModelManager] Model download failed:', error);
      throw error;
    }
  }

  /**
   * Update model to new version
   */
  async updateModel(
    version: string,
    options?: ModelLoadOptions
  ): Promise<void> {
    if (!isValidModelVersion(version)) {
      throw new Error(`Invalid model version: ${version}`);
    }

    try {
      // Download new model
      await this.downloadModel(version, options);

      // Update metadata
      const metadata: ModelInfo = {
        version,
        delegates: [],
        lastUpdated: new Date().toISOString(),
        description: `Plant classifier model ${version}`,
      };

      await this.saveModelMetadata(metadata);

      console.log(`[ModelManager] Model updated to version ${version}`);
    } catch (error) {
      console.error('[ModelManager] Model update failed:', error);
      throw error;
    }
  }

  /**
   * Delete model and metadata
   */
  async deleteModel(): Promise<void> {
    const { modelPath, metadataPath, checksumsPath } = getModelPaths();

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

      this.modelInfo = null;
      console.log('[ModelManager] Model deleted');
    } catch (error) {
      console.error('[ModelManager] Model deletion failed:', error);
      throw error;
    }
  }

  /**
   * Ensure model directory exists
   */
  private async ensureModelDirectory(): Promise<void> {
    const { baseDir } = getModelPaths();

    try {
      const dirInfo = await FileSystem.getInfoAsync(baseDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
        console.log('[ModelManager] Created model directory');
      }
    } catch (error) {
      console.error('[ModelManager] Failed to create model directory:', error);
      throw error;
    }
  }

  /**
   * Get model file size in MB
   */
  async getModelSize(): Promise<number> {
    const { modelPath } = getModelPaths();

    try {
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      if (!fileInfo.exists) {
        return 0;
      }

      // FileInfo.size is in bytes, convert to MB
      return fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
    } catch (error) {
      console.error('[ModelManager] Failed to get model size:', error);
      return 0;
    }
  }

  /**
   * Validate model size constraint
   */
  async validateModelSize(): Promise<boolean> {
    const sizeInMB = await this.getModelSize();
    return sizeInMB > 0 && sizeInMB <= MODEL_CONFIG.MAX_MODEL_SIZE_MB;
  }
}

// Singleton instance
let modelManagerInstance: ModelManager | null = null;

/**
 * Get singleton model manager instance
 */
export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }
  return modelManagerInstance;
}
