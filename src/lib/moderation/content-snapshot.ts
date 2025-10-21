/**
 * Content snapshot manager with cryptographic hashing
 *
 * Captures immutable snapshots of reported content to prevent
 * post-report modifications (DSA compliance requirement)
 *
 * Requirements: 1.6
 */

// Use React Native compatible crypto if available, otherwise use a polyfill
// Note: In production, this should use expo-crypto for native SHA-256 hashing
import * as Crypto from 'expo-crypto';

import type { ContentSnapshot, ContentType } from '@/types/moderation';

// ============================================================================
// Content Snapshot Functions
// ============================================================================

/**
 * Generates SHA-256 hash of content data
 *
 * @param content - Content to hash
 * @returns Hexadecimal hash string
 */
export async function generateContentHash(content: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      content,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return hash;
  } catch (error) {
    console.error('Failed to generate content hash:', error);
    throw new Error('Failed to generate cryptographic hash for content');
  }
}

/**
 * Creates a content snapshot with cryptographic hash
 *
 * @param contentId - ID of the content
 * @param contentType - Type of content
 * @param contentData - Full content data to snapshot
 * @param reportId - Optional report ID that triggered the snapshot
 * @returns Content snapshot with hash
 */
export interface CreateSnapshotOptions {
  contentId: string;
  contentType: ContentType;
  contentData: Record<string, any>;
  reportId?: string;
}

export async function createContentSnapshot(
  options: CreateSnapshotOptions
): Promise<ContentSnapshot> {
  const { contentId, contentType, contentData, reportId } = options;
  // Serialize content data for hashing
  const serializedContent = JSON.stringify(contentData);

  // Generate cryptographic hash
  const hash = await generateContentHash(serializedContent);

  const snapshot: ContentSnapshot = {
    id: generateSnapshotId(),
    content_id: contentId,
    content_type: contentType,
    snapshot_hash: hash,
    snapshot_data: contentData,
    captured_at: new Date(),
    captured_by_report_id: reportId,
    created_at: new Date(),
  };

  return snapshot;
}

/**
 * Verifies content snapshot integrity by comparing hashes
 *
 * @param snapshot - Content snapshot to verify
 * @returns True if hash matches, false if tampered
 */
export async function verifySnapshotIntegrity(
  snapshot: ContentSnapshot
): Promise<boolean> {
  try {
    // Recalculate hash from snapshot data
    const serializedContent = JSON.stringify(snapshot.snapshot_data);
    const recalculatedHash = await generateContentHash(serializedContent);

    // Compare with stored hash
    return recalculatedHash === snapshot.snapshot_hash;
  } catch (error) {
    console.error('Failed to verify snapshot integrity:', error);
    return false;
  }
}

/**
 * Generates a unique snapshot ID
 *
 * @returns UUID v4 string
 */
function generateSnapshotId(): string {
  // Use crypto.randomUUID() if available, otherwise fallback
  return Crypto.randomUUID();
}

/**
 * Extracts minimal snapshot data for storage efficiency
 *
 * This function implements data minimization by extracting only
 * essential fields needed for moderation review
 *
 * @param fullContentData - Full content object
 * @param contentType - Type of content
 * @returns Minimal snapshot data
 */
export function extractMinimalSnapshotData(
  fullContentData: Record<string, any>,
  contentType: ContentType
): Record<string, any> {
  const baseFields = ['id', 'created_at', 'updated_at'];

  switch (contentType) {
    case 'post':
      return {
        ...pickFields(fullContentData, [
          ...baseFields,
          'user_id',
          'title',
          'content',
          'media_urls',
          'visibility',
        ]),
      };

    case 'comment':
      return {
        ...pickFields(fullContentData, [
          ...baseFields,
          'user_id',
          'post_id',
          'content',
          'parent_comment_id',
        ]),
      };

    case 'image':
      return {
        ...pickFields(fullContentData, [
          ...baseFields,
          'user_id',
          'url',
          'caption',
          'alt_text',
        ]),
      };

    case 'profile':
      return {
        ...pickFields(fullContentData, [
          ...baseFields,
          'username',
          'display_name',
          'bio',
          'avatar_url',
        ]),
      };

    default:
      // For 'other' types, include all data
      return fullContentData;
  }
}

/**
 * Helper function to pick specific fields from an object
 *
 * @param obj - Source object
 * @param fields - Array of field names to pick
 * @returns Object with only specified fields
 */
function pickFields(
  obj: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }

  return result;
}
