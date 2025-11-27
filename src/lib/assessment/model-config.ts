// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { ExecutionProvider } from '@/types/assessment';

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
 * Model configuration and metadata
 * Defines model versions, execution providers, and performance constraints
 */

export const MODEL_CONFIG = {
  // Current active model version
  CURRENT_VERSION: 'v1.0.0',

  // Model file naming
  MODEL_FILENAME: 'plant_classifier_v1.ort',
  METADATA_FILENAME: 'plant_classifier_v1.json',
  CHECKSUMS_FILENAME: 'checksums.json',

  // Model constraints
  MAX_MODEL_SIZE_MB: 20,
  MIN_MODEL_VERSION: '1.0.0',

  // Performance SLOs (milliseconds)
  DEVICE_INFERENCE_DEADLINE_MS: 3500, // 3.5s p95 target
  CLOUD_INFERENCE_DEADLINE_MS: 5000, // 5s p95 target
  HARD_TIMEOUT_MS: 8000, // 8s absolute maximum

  // Execution provider preferences (in order of preference)
  EXECUTION_PROVIDERS: {
    ios: ['coreml', 'cpu'] as ExecutionProvider[], // XNNPACK not guaranteed on iOS
    android: ['nnapi', 'xnnpack', 'cpu'] as ExecutionProvider[],
    default: ['xnnpack', 'cpu'] as ExecutionProvider[],
  },

  // Warmup configuration
  WARMUP: {
    ENABLED: true,
    TENSOR_SHAPE: [1, 224, 224, 3], // Standard input shape for EfficientNet-Lite0/MobileNetV3
    ITERATIONS: 3,
  },

  // Assessment classes (canonical list from design.md)
  CLASSES: [
    { id: 'healthy', name: 'Healthy', category: 'healthy', isOod: false },
    {
      id: 'unknown',
      name: 'Unknown / Out-of-Distribution',
      category: 'unknown',
      isOod: true,
    },
    {
      id: 'nitrogen_deficiency',
      name: 'Nitrogen deficiency',
      category: 'nutrient',
      isOod: false,
    },
    {
      id: 'phosphorus_deficiency',
      name: 'Phosphorus deficiency',
      category: 'nutrient',
      isOod: false,
    },
    {
      id: 'potassium_deficiency',
      name: 'Potassium deficiency',
      category: 'nutrient',
      isOod: false,
    },
    {
      id: 'magnesium_deficiency',
      name: 'Magnesium deficiency',
      category: 'nutrient',
      isOod: false,
    },
    {
      id: 'calcium_deficiency',
      name: 'Calcium deficiency',
      category: 'nutrient',
      isOod: false,
    },
    {
      id: 'overwatering',
      name: 'Overwatering (water stress)',
      category: 'stress',
      isOod: false,
    },
    {
      id: 'underwatering',
      name: 'Underwatering (drought stress)',
      category: 'stress',
      isOod: false,
    },
    {
      id: 'light_burn',
      name: 'Light burn (excess light / heat stress)',
      category: 'stress',
      isOod: false,
    },
    {
      id: 'spider_mites',
      name: 'Spider mites (pest)',
      category: 'pest',
      isOod: false,
    },
    {
      id: 'powdery_mildew',
      name: 'Powdery mildew (pathogen)',
      category: 'pathogen',
      isOod: false,
    },
  ] as const,

  // Confidence thresholds
  CONFIDENCE: {
    MINIMUM_THRESHOLD: 0.7, // Below this triggers Unknown/OOD handling
    HIGH_CONFIDENCE: 0.85,
    MEDIUM_CONFIDENCE: 0.7,
  },
} as const;

/**
 * Get execution providers for current platform
 */
export function getExecutionProvidersForPlatform(): ExecutionProvider[] {
  if (Platform.OS === 'ios') {
    return MODEL_CONFIG.EXECUTION_PROVIDERS.ios;
  }
  if (Platform.OS === 'android') {
    return MODEL_CONFIG.EXECUTION_PROVIDERS.android;
  }
  return MODEL_CONFIG.EXECUTION_PROVIDERS.default;
}

/**
 * Get model file paths
 */
export async function getModelPaths(): Promise<{
  baseDir: string;
  modelPath: string;
  metadataPath: string;
  checksumsPath: string;
}> {
  // Models are stored in app documents directory
  const baseDir = `${getDocumentDirectoryUri()}models/`;

  // Ensure the models directory exists
  try {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  } catch (error) {
    throw new Error(
      `Failed to create models directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return {
    baseDir,
    modelPath: `${baseDir}${MODEL_CONFIG.MODEL_FILENAME}`,
    metadataPath: `${baseDir}${MODEL_CONFIG.METADATA_FILENAME}`,
    checksumsPath: `${baseDir}${MODEL_CONFIG.CHECKSUMS_FILENAME}`,
  };
}

/**
 * Validate model version format
 */
export function isValidModelVersion(version: string): boolean {
  const versionRegex = /^v?\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}
