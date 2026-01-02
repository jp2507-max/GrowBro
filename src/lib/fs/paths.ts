// Shared filesystem path helpers
// Preserves defensive optional-chaining and error messages for compatibility
import { Paths } from 'expo-file-system';

/**
 * Ensure a directory URI ends with a trailing slash.
 * This is important because the new Paths API may return URIs without trailing slashes,
 * while consumers typically expect them for path concatenation.
 */
function ensureTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/**
 * Get the cache directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 * Always returns a URI with a trailing slash for consistent path concatenation.
 */
export function getCacheDirectoryUri(): string {
  const uri = Paths?.cache?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Cache directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return ensureTrailingSlash(uri);
}

/**
 * Get the document directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 * Always returns a URI with a trailing slash for consistent path concatenation.
 */
export function getDocumentDirectoryUri(): string {
  const uri = Paths?.document?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Document directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return ensureTrailingSlash(uri);
}
