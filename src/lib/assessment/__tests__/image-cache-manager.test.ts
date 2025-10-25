import * as FileSystem from 'expo-file-system';

import { storage } from '@/lib/storage';

import { ImageCacheManager } from '../image-cache-manager';

// Mock dependencies
jest.mock('expo-file-system');
jest.mock('@/lib/storage');

describe('ImageCacheManager', () => {
  let cacheManager: ImageCacheManager;
  let mockMetadata: any;
  const mockUri = 'file:///test/image.jpg';
  const mockAssessmentId = 'assessment-123';
  const mockSize = 1024000; // 1MB

  beforeEach(() => {
    jest.clearAllMocks();
    mockMetadata = { entries: {}, totalSize: 0 };
    cacheManager = new ImageCacheManager(10 * 1024 * 1024); // 10MB limit

    // Default mocks
    (storage.getString as jest.Mock).mockImplementation((key) => {
      if (key === 'assessment_cache_metadata') {
        return JSON.stringify(mockMetadata);
      }
      return null;
    });
    (storage.set as jest.Mock).mockImplementation((key, value) => {
      if (key === 'assessment_cache_metadata') {
        mockMetadata = JSON.parse(value);
      }
    });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: mockSize,
    });
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('add', () => {
    it('should add image to cache tracking', async () => {
      const createdAt = Date.now();
      await cacheManager.add({
        uri: mockUri,
        size: mockSize,
        assessmentId: mockAssessmentId,
        createdAt,
      });

      expect(storage.set).toHaveBeenCalledWith(
        'assessment_cache_metadata',
        expect.any(String)
      );
      expect(storage.set).toHaveBeenCalledWith(
        'assessment_cache_size',
        mockSize
      );
    });

    it('should update total cache size', async () => {
      await cacheManager.add({
        uri: mockUri,
        size: mockSize,
        assessmentId: mockAssessmentId,
      });

      const size = await cacheManager.getSize();
      expect(size).toBe(mockSize);
    });

    it('should trigger cleanup when over limit', async () => {
      const smallCache = new ImageCacheManager(500 * 1024); // 500KB limit
      const largeSize = 1024 * 1024; // 1MB

      // Mock existing metadata
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {},
          totalSize: 0,
        })
      );

      await smallCache.add({
        uri: mockUri,
        size: largeSize,
        assessmentId: mockAssessmentId,
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days old
      });

      // Cleanup should have been triggered
      expect(storage.set).toHaveBeenCalled();
    });
  });

  describe('touch', () => {
    it('should update last accessed timestamp', async () => {
      const initialTime = Date.now() - 1000;
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            [mockUri]: {
              uri: mockUri,
              size: mockSize,
              lastAccessed: initialTime,
              assessmentId: mockAssessmentId,
              createdAt: initialTime,
            },
          },
          totalSize: mockSize,
        })
      );

      await cacheManager.touch(mockUri);

      expect(storage.set).toHaveBeenCalledWith(
        'assessment_cache_metadata',
        expect.stringContaining(mockUri)
      );
    });

    it('should do nothing if URI not in cache', async () => {
      await cacheManager.touch('file:///nonexistent.jpg');

      // Should not throw and should not update
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('getSize', () => {
    it('should return total cache size', async () => {
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            [mockUri]: {
              uri: mockUri,
              size: mockSize,
              lastAccessed: Date.now(),
              assessmentId: mockAssessmentId,
              createdAt: Date.now(),
            },
          },
          totalSize: mockSize,
        })
      );

      const size = await cacheManager.getSize();
      expect(size).toBe(mockSize);
    });

    it('should return 0 for empty cache', async () => {
      const size = await cacheManager.getSize();
      expect(size).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should delete oldest files when over limit', async () => {
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            'file:///old.jpg': {
              uri: 'file:///old.jpg',
              size: 5 * 1024 * 1024,
              lastAccessed: oldTime,
              assessmentId: 'old-assessment',
              createdAt: oldTime,
            },
            'file:///new.jpg': {
              uri: 'file:///new.jpg',
              size: 6 * 1024 * 1024,
              lastAccessed: now,
              assessmentId: 'new-assessment',
              createdAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
            },
          },
          totalSize: 11 * 1024 * 1024, // 11MB (over 10MB limit)
        })
      );

      const freedBytes = await cacheManager.cleanup();

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///old.jpg', {
        idempotent: true,
      });
      expect(freedBytes).toBeGreaterThan(0);
    });

    it('should not delete files from active assessments', async () => {
      const now = Date.now();
      const recentTime = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago

      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            [mockUri]: {
              uri: mockUri,
              size: 15 * 1024 * 1024, // 15MB (over limit)
              lastAccessed: recentTime,
              assessmentId: mockAssessmentId,
              createdAt: recentTime, // Recent assessment
            },
          },
          totalSize: 15 * 1024 * 1024,
        })
      );

      await cacheManager.cleanup();

      // Should not delete recent assessment
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should remove entries for already deleted files', async () => {
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            [mockUri]: {
              uri: mockUri,
              size: mockSize,
              lastAccessed: Date.now() - 10 * 24 * 60 * 60 * 1000,
              assessmentId: mockAssessmentId,
              createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
            },
          },
          totalSize: mockSize,
        })
      );

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const freedBytes = await cacheManager.cleanup();

      expect(freedBytes).toBe(mockSize);
      expect(storage.set).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should delete all cached files', async () => {
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            'file:///image1.jpg': {
              uri: 'file:///image1.jpg',
              size: mockSize,
              lastAccessed: Date.now(),
              assessmentId: 'assessment-1',
              createdAt: Date.now(),
            },
            'file:///image2.jpg': {
              uri: 'file:///image2.jpg',
              size: mockSize,
              lastAccessed: Date.now(),
              assessmentId: 'assessment-2',
              createdAt: Date.now(),
            },
          },
          totalSize: mockSize * 2,
        })
      );

      await cacheManager.clear();

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
      expect(storage.set).toHaveBeenCalledWith(
        'assessment_cache_metadata',
        JSON.stringify({ entries: {}, totalSize: 0 })
      );
    });
  });

  describe('removeAssessment', () => {
    it('should remove all images for an assessment', async () => {
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            'file:///image1.jpg': {
              uri: 'file:///image1.jpg',
              size: mockSize,
              lastAccessed: Date.now(),
              assessmentId: mockAssessmentId,
              createdAt: Date.now(),
            },
            'file:///image2.jpg': {
              uri: 'file:///image2.jpg',
              size: mockSize,
              lastAccessed: Date.now(),
              assessmentId: 'other-assessment',
              createdAt: Date.now(),
            },
          },
          totalSize: mockSize * 2,
        })
      );

      const freedBytes = await cacheManager.removeAssessment(mockAssessmentId);

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///image1.jpg',
        { idempotent: true }
      );
      expect(freedBytes).toBe(mockSize);
    });

    it('should return 0 if assessment not found', async () => {
      const freedBytes = await cacheManager.removeAssessment('nonexistent');

      expect(freedBytes).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const now = Date.now();
      const oldTime = now - 1000;

      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: {
            'file:///old.jpg': {
              uri: 'file:///old.jpg',
              size: mockSize,
              lastAccessed: oldTime,
              assessmentId: 'old',
              createdAt: oldTime,
            },
            'file:///new.jpg': {
              uri: 'file:///new.jpg',
              size: mockSize,
              lastAccessed: now,
              assessmentId: 'new',
              createdAt: now,
            },
          },
          totalSize: mockSize * 2,
        })
      );

      const stats = await cacheManager.getStats();

      expect(stats.totalSize).toBe(mockSize * 2);
      expect(stats.entryCount).toBe(2);
      expect(stats.oldestEntry).toBe(oldTime);
      expect(stats.newestEntry).toBe(now);
    });

    it('should return null timestamps for empty cache', async () => {
      const stats = await cacheManager.getStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.entryCount).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });
});
