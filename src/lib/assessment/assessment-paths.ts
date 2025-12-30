// SDK 54 hybrid approach: Paths for directory URIs
import { Paths } from 'expo-file-system';

/**
 * Ensure a directory URI ends with a trailing slash.
 */
function ensureTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/**
 * Get the document directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 * Always returns a URI with a trailing slash for consistent path concatenation.
 */
function getDocumentDirectoryUri(): string {
  const uri = Paths?.document?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Document directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return ensureTrailingSlash(uri);
}

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getAssessmentDir(): string {
  return `${getDocumentDirectoryUri()}assessments/`;
}
