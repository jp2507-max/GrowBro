import { database } from '@/lib/watermelon';

import { getReferencedPhotoUris } from '../photo-storage-helpers';

jest.mock('@/lib/watermelon', () => ({
  database: {
    collections: {
      get: jest.fn(),
    },
  },
}));

const mockCollectionsGet = database.collections.get as jest.Mock;
const mockHarvestQuery = jest.fn();
const mockHarvestFetch = jest.fn();
const mockPlantQuery = jest.fn();
const mockPlantFetch = jest.fn();

// Setup mock to return different query mocks based on collection name
mockCollectionsGet.mockImplementation((collectionName: string) => {
  if (collectionName === 'harvests') {
    return {
      query: mockHarvestQuery,
    };
  }
  if (collectionName === 'plants') {
    return {
      query: mockPlantQuery,
    };
  }
  return {
    query: jest
      .fn()
      .mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
  };
});

mockHarvestQuery.mockReturnValue({
  fetch: mockHarvestFetch,
});

mockPlantQuery.mockReturnValue({
  fetch: mockPlantFetch,
});

describe('photo-storage-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHarvestFetch.mockResolvedValue([]);
    mockPlantFetch.mockResolvedValue([]);
  });

  describe('getReferencedPhotoUris', () => {
    test('returns empty array when no harvests or plants exist', async () => {
      const result = await getReferencedPhotoUris();

      expect(result).toEqual([]);
      expect(mockHarvestFetch).toHaveBeenCalledTimes(1);
      expect(mockPlantFetch).toHaveBeenCalledTimes(1);
    });

    test('returns empty array when harvests have no photos and plants have no images', async () => {
      const harvests = [
        { photos: [] },
        { photos: null },
        { photos: undefined },
      ];
      const plants = [
        { imageUrl: null },
        { imageUrl: undefined },
        { imageUrl: '' },
      ];

      mockHarvestFetch.mockResolvedValue(harvests);
      mockPlantFetch.mockResolvedValue(plants);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([]);
    });

    test('extracts localUri from harvest photo objects correctly', async () => {
      const harvests = [
        {
          photos: [
            {
              variant: 'thumbnail',
              localUri: 'file:///photos/photo1.jpg',
              remotePath: 'remote/photo1.jpg',
            },
            { variant: 'full', localUri: 'file:///photos/photo2.jpg' },
          ],
        },
        {
          photos: [
            {
              variant: 'thumbnail',
              localUri: 'file:///photos/photo3.jpg',
              remotePath: 'remote/photo3.jpg',
            },
          ],
        },
      ];

      mockHarvestFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toContain('file:///photos/photo1.jpg');
      expect(result).toContain('file:///photos/photo2.jpg');
      expect(result).toContain('file:///photos/photo3.jpg');
    });

    test('extracts imageUrl from plant records correctly', async () => {
      const plants = [
        { imageUrl: 'file:///plant-photos/abc123.jpg' },
        { imageUrl: 'file:///plant-photos/def456.jpg' },
      ];

      mockPlantFetch.mockResolvedValue(plants);

      const result = await getReferencedPhotoUris();

      expect(result).toContain('file:///plant-photos/abc123.jpg');
      expect(result).toContain('file:///plant-photos/def456.jpg');
    });

    test('combines harvest and plant photo URIs', async () => {
      const harvests = [
        {
          photos: [
            { variant: 'thumbnail', localUri: 'file:///photos/harvest1.jpg' },
          ],
        },
      ];
      const plants = [{ imageUrl: 'file:///plant-photos/plant1.jpg' }];

      mockHarvestFetch.mockResolvedValue(harvests);
      mockPlantFetch.mockResolvedValue(plants);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([
        'file:///photos/harvest1.jpg',
        'file:///plant-photos/plant1.jpg',
      ]);
    });

    test('filters out non-file:// plant image URLs', async () => {
      const plants = [
        { imageUrl: 'file:///plant-photos/local.jpg' },
        { imageUrl: 'https://example.com/remote.jpg' },
        { imageUrl: 'http://example.com/another.jpg' },
      ];

      mockPlantFetch.mockResolvedValue(plants);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual(['file:///plant-photos/local.jpg']);
    });

    test('filters out photos without localUri', async () => {
      const harvests = [
        {
          photos: [
            { variant: 'thumbnail', localUri: 'file:///photos/photo1.jpg' },
            { variant: 'full' }, // missing localUri
            { variant: 'original', localUri: '' }, // empty localUri
          ],
        },
      ];

      mockHarvestFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual(['file:///photos/photo1.jpg']);
    });

    test('handles mixed photo types correctly', async () => {
      const harvests = [
        {
          photos: [
            { variant: 'thumbnail', localUri: 'file:///photos/photo1.jpg' },
            'invalid-string-photo', // old format string (should be ignored)
            { variant: 'full', localUri: 'file:///photos/photo2.jpg' },
          ],
        },
      ];

      mockHarvestFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toContain('file:///photos/photo1.jpg');
      expect(result).toContain('file:///photos/photo2.jpg');
    });

    test('handles harvest database errors gracefully', async () => {
      mockHarvestFetch.mockRejectedValue(new Error('Database error'));

      const result = await getReferencedPhotoUris();

      // Should still include plant URIs even if harvest query fails
      expect(result).toEqual([]);
    });

    test('handles plant database errors gracefully', async () => {
      mockPlantFetch.mockRejectedValue(new Error('Database error'));

      const result = await getReferencedPhotoUris();

      // Should still include harvest URIs even if plant query fails
      expect(result).toEqual([]);
    });
  });
});
