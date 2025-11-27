// SDK 54 hybrid approach: Paths for directory URIs
import { Paths } from 'expo-file-system';

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

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getAssessmentDir(): string {
  return `${getDocumentDirectoryUri()}assessments/`;
}
