import * as FileSystem from 'expo-file-system';

import type { ModelInfo, ModelLoadOptions } from '@/types/assessment';

import { getModelPaths } from './model-config';
import { deleteModel, downloadModel, updateModel } from './model-lifecycle';
import { loadModelMetadata, saveModelMetadata } from './model-metadata';
import {
  getModelSize,
  validateModelChecksum,
  validateModelSize,
} from './model-validation';

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
      this.modelInfo = await loadModelMetadata();
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
    const { modelPath } = await getModelPaths();
    const fileInfo = await FileSystem.getInfoAsync(modelPath);
    return fileInfo.exists;
  }

  /**
   * Validate model file integrity using SHA-256 checksum
   */
  async validateModelChecksum(
    expectedChecksum?: string
  ): Promise<{ valid: boolean; actualChecksum: string }> {
    return validateModelChecksum(expectedChecksum);
  }

  /**
   * Load model metadata from disk
   */
  async loadModelMetadata(): Promise<ModelInfo | null> {
    this.modelInfo = await loadModelMetadata();
    return this.modelInfo;
  }

  /**
   * Save model metadata to disk
   */
  async saveModelMetadata(metadata: ModelInfo): Promise<void> {
    await saveModelMetadata(metadata);
    this.modelInfo = metadata;
  }

  /**
   * Download model from remote storage
   */
  async downloadModel(
    version: string,
    options?: ModelLoadOptions
  ): Promise<void> {
    return downloadModel(version, options);
  }

  /**
   * Update model to new version
   */
  async updateModel(
    version: string,
    options?: ModelLoadOptions
  ): Promise<void> {
    this.modelInfo = await updateModel(version, options);
  }

  /**
   * Delete model and metadata
   */
  async deleteModel(): Promise<void> {
    await deleteModel();
    this.modelInfo = null;
  }

  /**
   * Ensure model directory exists
   */
  private async ensureModelDirectory(): Promise<void> {
    const { baseDir } = await getModelPaths();

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
    return getModelSize();
  }

  /**
   * Validate model size constraint
   */
  async validateModelSize(): Promise<boolean> {
    return validateModelSize();
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
