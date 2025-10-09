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
const mockQuery = jest.fn();
const mockFetch = jest.fn();

mockCollectionsGet.mockReturnValue({
  query: mockQuery,
});

mockQuery.mockReturnValue({
  fetch: mockFetch,
});

describe('photo-storage-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReferencedPhotoUris', () => {
    test('returns empty array when no harvests exist', async () => {
      mockFetch.mockResolvedValue([]);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('returns empty array when harvests have no photos', async () => {
      const harvests = [
        { photos: [] },
        { photos: null },
        { photos: undefined },
      ];

      mockFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([]);
    });

    test('extracts localUri from photo objects correctly', async () => {
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

      mockFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([
        'file:///photos/photo1.jpg',
        'file:///photos/photo2.jpg',
        'file:///photos/photo3.jpg',
      ]);
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

      mockFetch.mockResolvedValue(harvests);

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

      mockFetch.mockResolvedValue(harvests);

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([
        'file:///photos/photo1.jpg',
        'file:///photos/photo2.jpg',
      ]);
    });

    test('handles database errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Database error'));

      const result = await getReferencedPhotoUris();

      expect(result).toEqual([]);
    });
  });
});
