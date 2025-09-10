/**
 * Example: How to replace Node.js path module with URL-safe path utility
 * This shows the BEFORE and AFTER patterns for fixing Expo/RN compatibility
 */

import { dirname, normalizePath } from '@/lib/utils/path-utils';

// BEFORE (Node.js path - doesn't work in Expo/RN):
// import path from 'path';
//
// function exampleWithNodePath() {
//   const tempFilePath = path.join('/some/base/path', 'temp', 'data.json');
//   const parentDir = path.dirname(tempFilePath);
//   // ... rest of function
// }

// AFTER (URL-safe path utility - works in Expo/RN):
export function exampleWithUrlSafePath(): {
  tempFilePath: string;
  parentDir: string;
} {
  // Replace path.join with normalizePath for proper path normalization
  const tempFilePath = normalizePath('/some/base/path/temp/data.json');

  // Replace path.dirname with dirname
  const parentDir = dirname(tempFilePath);

  // Ensure directory exists (using Expo FileSystem)
  // const ensureDirectoryExists = async (dirPath: string) => {
  //   try {
  //     const info = await FileSystem.getInfoAsync(dirPath);
  //     if (!info.exists) {
  //       await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  //     }
  //   } catch {
  //     await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  //   }
  // };

  // await ensureDirectoryExists(parentDir);

  return {
    tempFilePath, // Will be: '/some/base/path/temp/data.json'
    parentDir, // Will be: '/some/base/path/temp'
  };
}

// Additional examples of common path operations:

export function pathOperationsExample(): {
  fullPath: string;
  dir: string;
  fileName: string;
  normalized: string;
} {
  // Joining multiple path segments
  const fullPath = normalizePath('exports/2024/data.json');
  // Result: 'exports/2024/data.json'

  // Getting directory from a path
  const dir = dirname('/user/documents/file.txt');
  // Result: '/user/documents'

  // Getting base name (file name without directory)
  const fileName = fullPath.split('/').pop() || '';
  // Result: 'data.json'

  // Normalizing paths (resolving .. and .)
  const normalized = normalizePath('a/b/../c');
  // Result: 'a/c'

  return { fullPath, dir, fileName, normalized };
}

// Example of how to structure data export functionality
export type ExportOptions = {
  basePath: string;
  filename: string;
  format: 'json' | 'csv' | 'xml';
};

export function buildExportPaths(options: ExportOptions): {
  tempFilePath: string;
  parentDir: string;
  exportPath: string;
} {
  const { basePath, filename, format } = options;

  // Build temp file path
  const tempFilePath = normalizePath(`${basePath}/temp/${filename}.${format}`);

  // Get parent directory for ensuring it exists
  const parentDir = dirname(tempFilePath);

  // Build final export path
  const exportPath = normalizePath(`${basePath}/exports/${filename}.${format}`);

  return {
    tempFilePath,
    parentDir,
    exportPath,
  };
}
