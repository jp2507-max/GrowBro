/**
 * Unit tests for harvest photo queue service
 */

import type { PhotoVariants } from '@/types/photo-storage';

import { enqueueHarvestPhotos } from './harvest-photo-queue';
import { enqueueHarvestPhotoVariant } from './queue';

// Mock queue service
jest.mock('./queue', () => ({
  enqueueHarvestPhotoVariant: jest.fn(),
}));

describe('enqueueHarvestPhotos', () => {
  const mockEnqueueVariant = enqueueHarvestPhotoVariant as jest.MockedFunction<
    typeof enqueueHarvestPhotoVariant
  >;

  const mockVariants: PhotoVariants = {
    original: 'file:///photos/abc123.jpg',
    resized: 'file:///photos/abc123_resized.jpg',
    thumbnail: 'file:///photos/abc123_thumb.jpg',
    metadata: {
      width: 4000,
      height: 3000,
      mimeType: 'image/jpeg',
      fileSize: 2500000,
      gpsStripped: true,
      capturedAt: '2025-01-07T12:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueVariant.mockImplementation((options) =>
      Promise.resolve(`queue-${options.variant}`)
    );
  });

  test('enqueues all three variants', async () => {
    const queueIds = await enqueueHarvestPhotos(
      mockVariants,
      'user123',
      'harvest456'
    );

    expect(queueIds).toHaveLength(3);
    expect(mockEnqueueVariant).toHaveBeenCalledTimes(3);
  });

  test('enqueues original variant with correct parameters', async () => {
    await enqueueHarvestPhotos(mockVariants, 'user123', 'harvest456');

    expect(mockEnqueueVariant).toHaveBeenCalledWith({
      localUri: 'file:///photos/abc123.jpg',
      userId: 'user123',
      harvestId: 'harvest456',
      variant: 'original',
      hash: 'abc123',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });
  });

  test('enqueues resized variant with correct parameters', async () => {
    await enqueueHarvestPhotos(mockVariants, 'user123', 'harvest456');

    expect(mockEnqueueVariant).toHaveBeenCalledWith({
      localUri: 'file:///photos/abc123_resized.jpg',
      userId: 'user123',
      harvestId: 'harvest456',
      variant: 'resized',
      hash: 'abc123_resized',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });
  });

  test('enqueues thumbnail variant with correct parameters', async () => {
    await enqueueHarvestPhotos(mockVariants, 'user123', 'harvest456');

    expect(mockEnqueueVariant).toHaveBeenCalledWith({
      localUri: 'file:///photos/abc123_thumb.jpg',
      userId: 'user123',
      harvestId: 'harvest456',
      variant: 'thumbnail',
      hash: 'abc123_thumb',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });
  });

  test('extracts hash from filename correctly', async () => {
    const variants: PhotoVariants = {
      original: 'file:///path/to/xyz789.png',
      resized: 'file:///path/to/xyz789_resized.png',
      thumbnail: 'file:///path/to/xyz789_thumb.png',
      metadata: {
        width: 2000,
        height: 1500,
        mimeType: 'image/png',
        fileSize: 1000000,
        capturedAt: '2025-01-07T12:00:00Z',
        gpsStripped: true,
      },
    };

    await enqueueHarvestPhotos(variants, 'user123', 'harvest456');

    expect(mockEnqueueVariant).toHaveBeenCalledWith(
      expect.objectContaining({ hash: 'xyz789' })
    );
  });

  test('extracts extension from URI correctly', async () => {
    const pngVariants: PhotoVariants = {
      original: 'file:///photos/abc123.png',
      resized: 'file:///photos/abc123_resized.png',
      thumbnail: 'file:///photos/abc123_thumb.png',
      metadata: {
        width: 4000,
        height: 3000,
        mimeType: 'image/png',
        fileSize: 2000000,
        capturedAt: '2025-01-07T12:00:00Z',
        gpsStripped: true,
      },
    };

    await enqueueHarvestPhotos(pngVariants, 'user123', 'harvest456');

    const calls = mockEnqueueVariant.mock.calls;
    calls.forEach((call) => {
      expect(call[0].extension).toBe('png');
    });
  });

  test('uses mime type from metadata', async () => {
    await enqueueHarvestPhotos(mockVariants, 'user123', 'harvest456');

    const calls = mockEnqueueVariant.mock.calls;
    calls.forEach((call) => {
      expect(call[0].mimeType).toBe('image/jpeg');
    });
  });

  test('defaults to image/jpeg if no mime type', async () => {
    const variantsWithoutMime: PhotoVariants = {
      ...mockVariants,
      metadata: {
        ...mockVariants.metadata,
        mimeType: undefined,
      },
    };

    await enqueueHarvestPhotos(variantsWithoutMime, 'user123', 'harvest456');

    const calls = mockEnqueueVariant.mock.calls;
    calls.forEach((call) => {
      expect(call[0].mimeType).toBe('image/jpeg');
    });
  });

  test('returns array of queue IDs in order', async () => {
    mockEnqueueVariant
      .mockResolvedValueOnce('queue-1')
      .mockResolvedValueOnce('queue-2')
      .mockResolvedValueOnce('queue-3');

    const queueIds = await enqueueHarvestPhotos(
      mockVariants,
      'user123',
      'harvest456'
    );

    expect(queueIds).toEqual(['queue-1', 'queue-2', 'queue-3']);
  });

  test('handles complex filenames with underscores', async () => {
    const variants: PhotoVariants = {
      original: 'file:///photos/abc_123_def.jpg',
      resized: 'file:///photos/abc_123_def_resized.jpg',
      thumbnail: 'file:///photos/abc_123_def_thumb.jpg',
      metadata: {
        width: 4000,
        height: 3000,
        mimeType: 'image/jpeg',
        fileSize: 2500000,
        capturedAt: '2025-01-07T12:00:00Z',
        gpsStripped: true,
      },
    };

    await enqueueHarvestPhotos(variants, 'user123', 'harvest456');

    expect(mockEnqueueVariant).toHaveBeenCalledWith(
      expect.objectContaining({ hash: 'abc_123_def' })
    );
  });

  test('handles HEIC format', async () => {
    const heicVariants: PhotoVariants = {
      original: 'file:///photos/abc123.heic',
      resized: 'file:///photos/abc123_resized.jpg',
      thumbnail: 'file:///photos/abc123_thumb.jpg',
      metadata: {
        width: 4000,
        height: 3000,
        mimeType: 'image/heic',
        fileSize: 1500000,
        capturedAt: '2025-01-07T12:00:00Z',
        gpsStripped: true,
      },
    };

    await enqueueHarvestPhotos(heicVariants, 'user123', 'harvest456');

    // Original should be HEIC
    expect(mockEnqueueVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'original',
        extension: 'heic',
        mimeType: 'image/heic',
      })
    );

    // Resized and thumbnail should be JPG
    expect(mockEnqueueVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'resized',
        extension: 'jpg',
      })
    );
  });

  test('handles edge case with no extension - whole URI becomes extension', async () => {
    const noExtVariants: PhotoVariants = {
      original: 'file:///photos/abc123',
      resized: 'file:///photos/abc123_resized',
      thumbnail: 'file:///photos/abc123_thumb',
      metadata: {
        width: 4000,
        height: 3000,
        mimeType: 'image/jpeg',
        fileSize: 2500000,
        capturedAt: '2025-01-07T12:00:00Z',
        gpsStripped: true,
      },
    };

    await enqueueHarvestPhotos(noExtVariants, 'user123', 'harvest456');

    // When URI has no '.' for extension, split('.').pop() returns entire string
    const calls = mockEnqueueVariant.mock.calls;
    expect(calls[0][0].extension).toBe('file:///photos/abc123');
    // Hash extraction finds last '/' and takes filename = 'abc123'
    expect(calls[0][0].hash).toBe('abc123');
  });
});
