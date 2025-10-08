/**
 * Photo storage types for harvest workflow
 *
 * Requirements:
 * - 8.2: Store files in filesystem with metadata in database
 * - 13.1: Save files to device filesystem with only URIs in database
 * - 13.2: Generate original, resized (~1280px), and thumbnail variants
 */

export type PhotoVariant = 'original' | 'resized' | 'thumbnail';

export interface PhotoVariants {
  /** Original photo URI (after EXIF stripping) */
  original: string;
  /** Resized variant URI (~1280px long edge) */
  resized: string;
  /** Thumbnail variant URI (200px long edge) */
  thumbnail: string;
  /** Extracted/preserved EXIF metadata */
  metadata: ExifMetadata;
}

export interface ExifMetadata {
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** EXIF orientation (1-8) */
  orientation?: number;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type */
  mimeType?: string;
  /** Capture timestamp (if available) */
  capturedAt?: string;
  /** Whether GPS data was stripped */
  gpsStripped: boolean;
}

export interface CleanupResult {
  /** Number of files deleted */
  filesDeleted: number;
  /** Bytes freed */
  bytesFreed: number;
  /** Duration of cleanup in milliseconds */
  durationMs: number;
  /** Orphaned files detected and removed */
  orphansRemoved: number;
}

export interface StorageInfo {
  /** Total storage capacity in bytes */
  totalBytes: number;
  /** Used storage in bytes */
  usedBytes: number;
  /** Available storage in bytes */
  availableBytes: number;
  /** Photo storage directory path */
  photoDirectory: string;
  /** Number of photo files */
  fileCount: number;
}

export interface PhotoStorageConfig {
  /** Target maximum storage in bytes (default: 300MB) */
  maxStorageBytes: number;
  /** Trigger cleanup threshold in bytes (default: 250MB) */
  cleanupThresholdBytes: number;
  /** Protection period for recent photos in days (default: 7) */
  recentPhotoProtectionDays: number;
  /** Whether to respect battery saver mode */
  respectBatterySaver: boolean;
  /** Whether to enable at-rest encryption */
  enableEncryption: boolean;
}

export const DEFAULT_PHOTO_STORAGE_CONFIG: PhotoStorageConfig = {
  maxStorageBytes: 300 * 1024 * 1024, // 300MB
  cleanupThresholdBytes: 250 * 1024 * 1024, // 250MB
  recentPhotoProtectionDays: 7,
  respectBatterySaver: true,
  enableEncryption: true,
};

export interface PhotoFile {
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (ms) */
  modifiedAt: number;
  /** Content hash (SHA-256) */
  hash: string;
}
