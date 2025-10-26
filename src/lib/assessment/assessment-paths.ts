import * as FileSystem from 'expo-file-system';

type FileSystemWithDocumentDirectory = typeof FileSystem & {
  documentDirectory: string | null | undefined;
};

const safeFileSystem = FileSystem as FileSystemWithDocumentDirectory;

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getAssessmentDir(): string {
  const { documentDirectory } = safeFileSystem;

  if (!documentDirectory) {
    throw new Error('Document directory is not available');
  }

  return `${documentDirectory}assessments/`;
}
