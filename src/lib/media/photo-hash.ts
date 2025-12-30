import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Content-addressable storage utilities for photo files
 *
 * Requirements:
 * - 13.1: Content-addressable storage with hash-based filenames
 * - Deduplication: same content = same hash = single file
 */

/**
 * Generate SHA-256 hash of file content
 *
 * Uses FileSystem.readAsStringAsync with base64 encoding for memory efficiency.
 * This avoids loading the entire file into JS heap as an ArrayBuffer.
 *
 * @param uri - File URI to hash
 * @returns SHA-256 hash (hex string)
 */
export async function hashFileContent(uri: string): Promise<string> {
  try {
    // Read file as base64 string directly - more memory efficient than ArrayBuffer
    // The legacy API is used for SDK 54 compatibility with async file operations
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Hash the base64 content
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    return hash;
  } catch (error) {
    throw new Error(
      `Failed to hash file content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate content-addressable filename from hash and extension
 *
 * @param hash - SHA-256 hash
 * @param extension - File extension (with or without leading dot)
 * @returns Filename in format: {hash}.{ext}
 */
export function generateHashedFilename(
  hash: string,
  extension: string
): string {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${hash}.${ext}`;
}

/**
 * Extract file extension from URI or filename
 *
 * @param uriOrFilename - File URI or filename
 * @returns Extension (without leading dot) or 'jpg' as fallback
 */
export function extractExtension(uriOrFilename: string): string {
  const match = uriOrFilename.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

/**
 * Check if file exists at given path
 *
 * @param path - File path (must be a file:// URI)
 * @returns True if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    // Validate input - must be a file:// URI
    if (!path || !path.startsWith('file://')) {
      return false;
    }
    const file = new File(path);
    return file.exists;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 *
 * @param path - File path
 * @returns File size in bytes, or 0 if file doesn't exist
 */
export async function getFileSize(path: string): Promise<number> {
  try {
    const file = new File(path);
    return file.exists ? file.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Delete file if it exists
 *
 * @param path - File path
 * @returns True if file was deleted
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    const file = new File(path);
    if (file.exists) {
      await file.delete();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
