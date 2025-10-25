import fs from 'fs/promises';
import path from 'path';

import type { AppConfig } from './config';

export type ModelContext = {
  status: 'warm' | 'cold';
  version?: string;
  modelPath?: string;
};

let cachedContext: ModelContext | null = null;

export async function getModelContext(
  config: AppConfig
): Promise<ModelContext> {
  if (cachedContext) {
    return cachedContext;
  }

  if (!config.MODEL_PATH) {
    cachedContext = { status: 'cold', version: config.MODEL_VERSION };
    return cachedContext;
  }

  const resolvedPath = path.resolve(config.MODEL_PATH);

  await validateModelPath(resolvedPath);

  cachedContext = {
    status: 'warm',
    version: config.MODEL_VERSION,
    modelPath: resolvedPath,
  };

  return cachedContext;
}

async function validateModelPath(resolvedPath: string): Promise<void> {
  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`MODEL_PATH does not point to a file: ${resolvedPath}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`MODEL_PATH not found: ${resolvedPath}`);
    }
    throw error;
  }
}
