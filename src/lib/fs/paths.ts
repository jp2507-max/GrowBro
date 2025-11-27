// Shared filesystem path helpers
// Preserves defensive optional-chaining and error messages for compatibility
import { Paths } from 'expo-file-system';

/**
 * Get the cache directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 */
export function getCacheDirectoryUri(): string {
  const uri = Paths?.cache?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Cache directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return uri;
}

/**
 * Get the document directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 */
export function getDocumentDirectoryUri(): string {
  const uri = Paths?.document?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Document directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return uri;
}
