/**
 * Unit tests for harvest photo cleanup service
 */

import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';

import {
  cleanupDeletedHarvestPhotos,
  cleanupHarvestPhotos,
} from '../harvest-photo-cleanup';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('@/lib/watermelon', () => ({
  database: {
    collections: {
      get: jest.fn(),
    },
  },
}));

describe('cleanupDeletedHarvestPhotos', () => {
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });

    // Mock database collections
    const mockHarvestsCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn(),
      }),
    };
    (database.collections.get as jest.Mock).mockReturnValue(
      mockHarvestsCollection
    );
  });

  test('should cleanup photos from soft-deleted harvests', async () => {
    // Mock deleted harvests with photos
    const mockDeletedHarvests = [
      {
        id: 'harvest-1',
        _raw: {
          photos: [
            { remotePath: 'user123/harvest-1/photo1_original.jpg' },
            { remotePath: 'user123/harvest-1/photo1_resized.jpg' },
          ],
        },
      },
      {
        id: 'harvest-2',
        _raw: {
          photos: [{ remotePath: 'user456/harvest-2/photo2_original.jpg' }],
        },
      },
    ];

    const mockQuery = {
      fetch: jest.fn().mockResolvedValue(mockDeletedHarvests),
    };
    const mockCollection = {
      query: jest.fn().mockReturnValue(mockQuery),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    // Mock successful storage removal
    mockRemove.mockResolvedValueOnce({
      data: [
        { name: 'user123/harvest-1/photo1_original.jpg' },
        { name: 'user123/harvest-1/photo1_resized.jpg' },
      ],
      error: null,
    });

    mockRemove.mockResolvedValueOnce({
      data: [{ name: 'user456/harvest-2/photo2_original.jpg' }],
      error: null,
    });

    const result = await cleanupDeletedHarvestPhotos();

    // Verify results
    expect(result.harvestsProcessed).toBe(2);
    expect(result.photosDeleted).toBe(3); // 2 + 1 photos
    expect(result.errors).toBe(0);

    // Verify storage calls
    expect(supabase.storage.from).toHaveBeenCalledWith('harvest-photos');
    expect(mockRemove).toHaveBeenCalledTimes(2);

    // Verify paths were stripped of bucket prefix
    expect(mockRemove).toHaveBeenCalledWith([
      'user123/harvest-1/photo1_original.jpg',
      'user123/harvest-1/photo1_resized.jpg',
    ]);
    expect(mockRemove).toHaveBeenCalledWith([
      'user456/harvest-2/photo2_original.jpg',
    ]);
  });

  test('should handle harvests without photos', async () => {
    const mockDeletedHarvests = [
      {
        id: 'harvest-1',
        _raw: {
          photos: [], // No photos
        },
      },
    ];

    const mockQuery = {
      fetch: jest.fn().mockResolvedValue(mockDeletedHarvests),
    };
    const mockCollection = {
      query: jest.fn().mockReturnValue(mockQuery),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    const result = await cleanupDeletedHarvestPhotos();

    expect(result.harvestsProcessed).toBe(1);
    expect(result.photosDeleted).toBe(0);
    expect(result.errors).toBe(0);

    // Should not call storage.remove when no photos
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('should handle invalid photos JSON', async () => {
    const mockDeletedHarvests = [
      {
        id: 'harvest-1',
        _raw: {
          photos: 'invalid json', // Not an array
        },
      },
    ];

    const mockQuery = {
      fetch: jest.fn().mockResolvedValue(mockDeletedHarvests),
    };
    const mockCollection = {
      query: jest.fn().mockReturnValue(mockQuery),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    const result = await cleanupDeletedHarvestPhotos();

    expect(result.harvestsProcessed).toBe(1);
    expect(result.photosDeleted).toBe(0);
    expect(result.errors).toBe(0);

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('should handle storage errors gracefully', async () => {
    const mockDeletedHarvests = [
      {
        id: 'harvest-1',
        _raw: {
          photos: [{ remotePath: 'user123/harvest-1/photo1_original.jpg' }],
        },
      },
    ];

    const mockQuery = {
      fetch: jest.fn().mockResolvedValue(mockDeletedHarvests),
    };
    const mockCollection = {
      query: jest.fn().mockReturnValue(mockQuery),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    // Mock storage error
    mockRemove.mockResolvedValue({
      data: null,
      error: { message: 'Storage quota exceeded' },
    });

    const result = await cleanupDeletedHarvestPhotos();

    expect(result.harvestsProcessed).toBe(1);
    expect(result.photosDeleted).toBe(0);
    expect(result.errors).toBe(0); // Individual harvest errors don't increment global error count
  });

  test('should handle database query errors', async () => {
    const mockCollection = {
      query: jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      }),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    const result = await cleanupDeletedHarvestPhotos();

    expect(result.harvestsProcessed).toBe(0);
    expect(result.photosDeleted).toBe(0);
    expect(result.errors).toBe(0);
  });
});

describe('cleanupHarvestPhotos', () => {
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });
  });

  test('should cleanup photos for specific harvest', async () => {
    const mockHarvest = {
      id: 'harvest-1',
      _raw: {
        photos: [
          { remotePath: 'user123/harvest-1/photo1_original.jpg' },
          { remotePath: 'user123/harvest-1/photo1_resized.jpg' },
        ],
      },
    };

    const mockCollection = {
      find: jest.fn().mockResolvedValue(mockHarvest),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    mockRemove.mockResolvedValue({
      data: [
        { name: 'user123/harvest-1/photo1_original.jpg' },
        { name: 'user123/harvest-1/photo1_resized.jpg' },
      ],
      error: null,
    });

    const deletedCount = await cleanupHarvestPhotos('harvest-1');

    expect(deletedCount).toBe(2);
    expect(supabase.storage.from).toHaveBeenCalledWith('harvest-photos');
    expect(mockRemove).toHaveBeenCalledWith([
      'user123/harvest-1/photo1_original.jpg',
      'user123/harvest-1/photo1_resized.jpg',
    ]);
  });

  test('should return 0 when harvest has no photos', async () => {
    const mockHarvest = {
      id: 'harvest-1',
      _raw: {
        photos: [],
      },
    };

    const mockCollection = {
      find: jest.fn().mockResolvedValue(mockHarvest),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    const deletedCount = await cleanupHarvestPhotos('harvest-1');

    expect(deletedCount).toBe(0);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('should handle harvest not found', async () => {
    const mockCollection = {
      find: jest.fn().mockRejectedValue(new Error('Harvest not found')),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    const deletedCount = await cleanupHarvestPhotos('nonexistent-harvest');

    expect(deletedCount).toBe(0);
  });

  test('should strip bucket prefix from remote paths', async () => {
    const mockHarvest = {
      id: 'harvest-1',
      _raw: {
        photos: [{ remotePath: 'harvest-photos/user123/harvest-1/photo1.jpg' }],
      },
    };

    const mockCollection = {
      find: jest.fn().mockResolvedValue(mockHarvest),
    };
    (database.collections.get as jest.Mock).mockReturnValue(mockCollection);

    mockRemove.mockResolvedValue({
      data: [{ name: 'user123/harvest-1/photo1.jpg' }],
      error: null,
    });

    await cleanupHarvestPhotos('harvest-1');

    // Should strip 'harvest-photos/' prefix
    expect(mockRemove).toHaveBeenCalledWith(['user123/harvest-1/photo1.jpg']);
  });
});
