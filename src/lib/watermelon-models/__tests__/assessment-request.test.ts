/* eslint-disable */
// @ts-nocheck
/**
 * Assessment Request Model Tests
 */
import { sanitizePhotos } from '../assessment-request';
import type {
  CapturedPhoto,
  QualityResult,
  PhotoMetadata,
} from '@/types/assessment';

describe('sanitizePhotos', () => {
  const mockValidPhoto: CapturedPhoto = {
    id: 'photo-1',
    uri: 'file://photo1.jpg',
    timestamp: 1234567890,
    qualityScore: {
      score: 0.85,
      acceptable: true,
      issues: [],
    },
    metadata: {
      width: 1920,
      height: 1080,
    },
  };

  const mockPhotoWithInvalidId: CapturedPhoto = {
    id: '',
    uri: 'file://photo2.jpg',
    timestamp: 1234567890,
    qualityScore: {
      score: 0.7,
      acceptable: false,
      issues: [],
    },
    metadata: {
      width: 1280,
      height: 720,
    },
  };

  const mockPhotoWithInvalidUri: CapturedPhoto = {
    id: 'photo-3',
    uri: '',
    timestamp: 1234567890,
    qualityScore: {
      score: 0.9,
      acceptable: true,
      issues: [],
    },
    metadata: {
      width: 800,
      height: 600,
    },
  };

  const mockPhotoWithInvalidTimestamp: CapturedPhoto = {
    id: 'photo-4',
    uri: 'file://photo4.jpg',
    timestamp: 'invalid' as any,
    qualityScore: {
      score: 0.6,
      acceptable: false,
      issues: [],
    },
    metadata: {
      width: 640,
      height: 480,
    },
  };

  const mockPhotoWithMissingQualityScore: CapturedPhoto = {
    id: 'photo-5',
    uri: 'file://photo5.jpg',
    timestamp: 1234567890,
    qualityScore: undefined as any,
    metadata: {
      width: 1024,
      height: 768,
    },
  };

  const mockPhotoWithComplexMetadata: CapturedPhoto = {
    id: 'photo-6',
    uri: 'file://photo6.jpg',
    timestamp: 1234567890,
    qualityScore: {
      score: 0.8,
      acceptable: true,
      issues: [],
    },
    metadata: {
      width: 1600,
      height: 1200,
      cameraModel: 'iPhone 12',
      iso: 100,
      exposureTimeMs: 33,
      aperture: 1.8,
      gps: null,
      extras: {
        someOtherField: 'ignored',
        anotherField: 123,
      },
    } as any,
  };

  test('returns empty array for non-array input', () => {
    expect(sanitizePhotos(undefined)).toEqual([]);
    expect(sanitizePhotos(null as any)).toEqual([]);
    expect(sanitizePhotos('not an array' as any)).toEqual([]);
    expect(sanitizePhotos({} as any)).toEqual([]);
  });

  test('filters out photos with missing or empty id', () => {
    const photos = [mockValidPhoto, mockPhotoWithInvalidId];
    const result = sanitizePhotos(photos);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('photo-1');
  });

  test('filters out photos with missing or empty uri', () => {
    const photos = [mockValidPhoto, mockPhotoWithInvalidUri];
    const result = sanitizePhotos(photos);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('photo-1');
  });

  test('filters out photos with whitespace-only id or uri', () => {
    const photosWithWhitespace = [
      mockValidPhoto,
      { ...mockValidPhoto, id: '   ' },
      { ...mockValidPhoto, uri: '\t\n  ' },
    ];
    const result = sanitizePhotos(photosWithWhitespace);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('photo-1');
  });

  test('limits results to MAX_PHOTOS after filtering', () => {
    // MAX_PHOTOS is 10, so create 15 photos, 10 valid
    const manyPhotos = Array.from({ length: 15 }, (_, i) => ({
      ...mockValidPhoto,
      id: `photo-${i}`,
      uri: `file://photo${i}.jpg`,
    }));

    const result = sanitizePhotos(manyPhotos);
    expect(result).toHaveLength(10);
  });

  test('coerces timestamp to number with fallback to Date.now()', () => {
    const result = sanitizePhotos([mockPhotoWithInvalidTimestamp]);

    expect(result).toHaveLength(1);
    expect(typeof result[0].timestamp).toBe('number');
    expect(result[0].timestamp).toBeGreaterThan(1234567890); // Should be current time
  });

  test('preserves valid timestamp as number', () => {
    const result = sanitizePhotos([mockValidPhoto]);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(1234567890);
  });

  test('sets default qualityScore when missing', () => {
    const result = sanitizePhotos([mockPhotoWithMissingQualityScore]);

    expect(result).toHaveLength(1);
    expect(result[0].qualityScore).toEqual({
      score: 0,
      acceptable: false,
      issues: [],
    });
  });

  test('preserves existing qualityScore when present', () => {
    const result = sanitizePhotos([mockValidPhoto]);

    expect(result).toHaveLength(1);
    expect(result[0].qualityScore).toEqual({
      score: 0.85,
      acceptable: true,
      issues: [],
    });
  });

  test('restricts metadata to only width and height', () => {
    const result = sanitizePhotos([mockPhotoWithComplexMetadata]);

    expect(result).toHaveLength(1);
    expect(result[0].metadata).toEqual({
      width: 1600,
      height: 1200,
    });
    // Ensure other metadata fields are ignored
    expect(result[0].metadata).not.toHaveProperty('cameraModel');
    expect(result[0].metadata).not.toHaveProperty('iso');
    expect(result[0].metadata).not.toHaveProperty('extras');
  });

  test('defaults metadata width and height to 0 when missing or invalid', () => {
    const photoWithMissingMetadata = {
      ...mockValidPhoto,
      metadata: undefined as any,
    };

    const photoWithInvalidMetadata = {
      ...mockValidPhoto,
      metadata: {
        width: 'invalid' as any,
        height: null as any,
      },
    };

    const result1 = sanitizePhotos([photoWithMissingMetadata]);
    const result2 = sanitizePhotos([photoWithInvalidMetadata]);

    expect(result1[0].metadata).toEqual({ width: 0, height: 0 });
    expect(result2[0].metadata).toEqual({ width: 0, height: 0 });
  });

  test('handles complex filtering and transformation in one pass', () => {
    const mixedPhotos = [
      mockValidPhoto,
      mockPhotoWithInvalidId,
      mockPhotoWithInvalidUri,
      mockPhotoWithInvalidTimestamp,
      mockPhotoWithMissingQualityScore,
      mockPhotoWithComplexMetadata,
    ];

    const result = sanitizePhotos(mixedPhotos);

    expect(result).toHaveLength(3); // Only valid photos should remain
    expect(result.map((p) => p.id)).toEqual(['photo-1', 'photo-4', 'photo-5']);

    // Check that all transformations were applied correctly
    result.forEach((photo) => {
      expect(typeof photo.id).toBe('string');
      expect(photo.id.trim()).not.toBe('');
      expect(typeof photo.uri).toBe('string');
      expect(photo.uri.trim()).not.toBe('');
      expect(typeof photo.timestamp).toBe('number');
      expect(typeof photo.qualityScore).toBe('object');
      expect(typeof photo.metadata.width).toBe('number');
      expect(typeof photo.metadata.height).toBe('number');
    });
  });

  test('returns empty array when all photos are filtered out', () => {
    const invalidPhotos = [
      mockPhotoWithInvalidId,
      mockPhotoWithInvalidUri,
      { ...mockValidPhoto, id: '   ' },
      { ...mockValidPhoto, uri: '\n' },
    ];

    const result = sanitizePhotos(invalidPhotos);
    expect(result).toEqual([]);
  });
});
