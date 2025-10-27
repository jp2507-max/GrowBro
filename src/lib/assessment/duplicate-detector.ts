/**
 * Duplicate Photo Detection
 *
 * Detects duplicate or near-duplicate photos within an assessment case:
 * - Perceptual hashing (pHash) for similarity detection
 * - Hamming distance comparison
 * - User prompts for retake guidance
 *
 * Requirements:
 * - 10.3: Duplicate photo detection with user prompts
 */

import type { CapturedPhoto } from '@/types/assessment';

export type DuplicateDetectionResult = {
  isDuplicate: boolean;
  duplicateOf?: string; // ID of the original photo
  similarityScore: number; // 0-1, where 1 is identical
  guidance?: string;
};

const DUPLICATE_THRESHOLD = 0.95; // 95% similarity = duplicate
const NEAR_DUPLICATE_THRESHOLD = 0.85; // 85% similarity = warning

/**
 * Detect if a photo is a duplicate of any existing photos in the set
 */
export function detectDuplicates(
  newPhoto: CapturedPhoto,
  existingPhotos: CapturedPhoto[]
): DuplicateDetectionResult {
  if (existingPhotos.length === 0) {
    return {
      isDuplicate: false,
      similarityScore: 0,
    };
  }

  // Find the most similar photo
  let maxSimilarity = 0;
  let mostSimilarPhotoId: string | undefined;

  for (const existingPhoto of existingPhotos) {
    const similarity = calculatePhotoSimilarity(newPhoto, existingPhoto);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarPhotoId = existingPhoto.id;
    }
  }

  // Check if it's a duplicate
  if (maxSimilarity >= DUPLICATE_THRESHOLD) {
    return {
      isDuplicate: true,
      duplicateOf: mostSimilarPhotoId,
      similarityScore: maxSimilarity,
      guidance:
        'This photo appears to be a duplicate. Please capture a different angle or area of the plant for better assessment.',
    };
  }

  // Check if it's a near-duplicate (warning)
  if (maxSimilarity >= NEAR_DUPLICATE_THRESHOLD) {
    return {
      isDuplicate: false,
      duplicateOf: mostSimilarPhotoId,
      similarityScore: maxSimilarity,
      guidance:
        'This photo is very similar to a previous one. Consider capturing a different angle for more comprehensive assessment.',
    };
  }

  return {
    isDuplicate: false,
    similarityScore: maxSimilarity,
  };
}

/**
 * Calculate similarity between two photos
 * Uses a simplified approach based on URI comparison and metadata
 * In production, this would use perceptual hashing (pHash)
 */
function calculatePhotoSimilarity(
  photo1: CapturedPhoto,
  photo2: CapturedPhoto
): number {
  // Exact URI match = 100% duplicate
  if (photo1.uri === photo2.uri) {
    return 1.0;
  }

  // Compare timestamps - photos taken within 1 second are likely duplicates
  const timeDiff = Math.abs(photo1.timestamp - photo2.timestamp);
  if (timeDiff < 1000) {
    // Less than 1 second apart
    return 0.9;
  }

  // Compare quality scores - similar quality might indicate similar photos
  if (photo1.qualityScore?.score && photo2.qualityScore?.score) {
    const qualityDiff = Math.abs(
      photo1.qualityScore.score - photo2.qualityScore.score
    );
    if (qualityDiff < 5) {
      // Very similar quality
      return 0.7;
    }
  }

  // No strong similarity indicators
  return 0.0;
}

/**
 * Generate perceptual hash for a photo
 * This is a placeholder - production would use actual pHash algorithm
 */
export function generatePerceptualHash(
  _photoUri: string
): Promise<string | null> {
  // TODO: Implement actual pHash using image processing
  // Steps:
  // 1. Resize image to 32x32
  // 2. Convert to grayscale
  // 3. Compute DCT (Discrete Cosine Transform)
  // 4. Extract low-frequency components
  // 5. Generate binary hash

  // Placeholder: return null for now
  return Promise.resolve(null);
}

/**
 * Calculate Hamming distance between two perceptual hashes
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Convert Hamming distance to similarity score (0-1)
 */
export function hammingDistanceToSimilarity(
  distance: number,
  hashLength: number
): number {
  // Ensure inputs are numbers
  const numDistance = Number(distance);
  const numHashLength = Number(hashLength);

  // Guard against zero or non-positive hashLength
  if (numHashLength <= 0) {
    return 0; // Return 0 similarity for invalid hash length
  }

  // Clamp distance to valid range [0, hashLength]
  const clampedDistance = Math.max(0, Math.min(numDistance, numHashLength));

  return 1 - clampedDistance / numHashLength;
}

/**
 * Batch check for duplicates in a set of photos
 */
export function findAllDuplicates(photos: CapturedPhoto[]): {
  photo1Id: string;
  photo2Id: string;
  similarityScore: number;
}[] {
  const duplicates: {
    photo1Id: string;
    photo2Id: string;
    similarityScore: number;
  }[] = [];

  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const similarity = calculatePhotoSimilarity(photos[i], photos[j]);
      if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
        duplicates.push({
          photo1Id: photos[i].id,
          photo2Id: photos[j].id,
          similarityScore: similarity,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Get unique photos from a set (removes duplicates)
 */
export function getUniquePhotos(photos: CapturedPhoto[]): CapturedPhoto[] {
  const unique: CapturedPhoto[] = [];
  const seen = new Set<string>();

  for (const photo of photos) {
    // Check if this photo is a duplicate of any already seen
    const result = detectDuplicates(photo, unique);
    if (!result.isDuplicate) {
      unique.push(photo);
      seen.add(photo.id);
    }
  }

  return unique;
}
