import * as Battery from 'expo-battery';
import * as FileSystem from 'expo-file-system';

import { DEFAULT_PHOTO_STORAGE_CONFIG } from '@/types/photo-storage';

import { cleanupLRU, initializeJanitor } from '../photo-janitor';
import * as photoStorageService from '../photo-storage-service';

jest.mock('expo-battery');
jest.mock('expo-file-system');
jest.mock('../photo-storage-service', () => ({
  getAllPhotoFiles: jest.fn(() => Promise.resolve([])),
  detectOrphans: jest.fn(() => Promise.resolve([])),
  cleanupOrphans: jest.fn(() =>
    Promise.resolve({ deletedCount: 0, deletedPaths: [] })
  ),
}));

describe('photo-janitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default battery state: charged and not low
    (Battery.getPowerStateAsync as jest.Mock).mockResolvedValue({
      batteryLevel: 0.8,
      batteryState: Battery.BatteryState.FULL,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('cleanupLRU', () => {
    it('should skip cleanup on low battery and not charging', async () => {
      (Battery.getPowerStateAsync as jest.Mock).mockResolvedValue({
        batteryLevel: 0.15,
        batteryState: Battery.BatteryState.UNPLUGGED,
      });

      const result = await cleanupLRU(DEFAULT_PHOTO_STORAGE_CONFIG, []);

      expect(result).toEqual({
        filesDeleted: 0,
        bytesFreed: 0,
        durationMs: expect.any(Number),
        orphansRemoved: 0,
      });
    });

    it('should proceed with cleanup on low battery but charging', async () => {
      (Battery.getPowerStateAsync as jest.Mock).mockResolvedValue({
        batteryLevel: 0.15,
        batteryState: Battery.BatteryState.CHARGING,
      });

      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;
      getAllPhotoFiles.mockResolvedValue([]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });

      await cleanupLRU(DEFAULT_PHOTO_STORAGE_CONFIG, []);

      expect(cleanupOrphans).toHaveBeenCalled();
    });

    it('should ignore battery state in aggressive mode', async () => {
      (Battery.getPowerStateAsync as jest.Mock).mockResolvedValue({
        batteryLevel: 0.1,
        batteryState: Battery.BatteryState.UNPLUGGED,
      });

      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;
      getAllPhotoFiles.mockResolvedValue([]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue(0);

      await cleanupLRU(DEFAULT_PHOTO_STORAGE_CONFIG, [], true);

      expect(cleanupOrphans).toHaveBeenCalled();
    });

    it('should detect and remove orphaned files', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      getAllPhotoFiles.mockResolvedValue([
        { path: 'file:///photo1.jpg', size: 1024, modifiedAt: Date.now() },
        { path: 'file:///photo2.jpg', size: 2048, modifiedAt: Date.now() },
      ]);
      detectOrphans.mockResolvedValue(['file:///photo2.jpg']);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 1,
        deletedPaths: ['file:///photo2.jpg'],
      });

      const result = await cleanupLRU(DEFAULT_PHOTO_STORAGE_CONFIG, [
        'file:///photo1.jpg',
      ]);

      expect(result.orphansRemoved).toBe(1);
      expect(cleanupOrphans).toHaveBeenCalledWith(['file:///photo2.jpg']);
    });

    it('should skip LRU cleanup if below threshold', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      getAllPhotoFiles.mockResolvedValue([
        {
          path: 'file:///photo1.jpg',
          size: 1024,
          modifiedAt: Date.now(),
        },
      ]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });

      const config = {
        ...DEFAULT_PHOTO_STORAGE_CONFIG,
        cleanupThresholdBytes: 100000,
      };

      const result = await cleanupLRU(config, ['file:///photo1.jpg']);

      expect(result.filesDeleted).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should delete oldest files when over threshold', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      const now = Date.now();
      const oldFile = {
        path: 'file:///old.jpg',
        size: 50000,
        modifiedAt: now - 100000,
      };
      const newFile = {
        path: 'file:///new.jpg',
        size: 50000,
        modifiedAt: now,
      };

      getAllPhotoFiles.mockResolvedValue([newFile, oldFile]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const config = {
        ...DEFAULT_PHOTO_STORAGE_CONFIG,
        maxStorageBytes: 60000,
        cleanupThresholdBytes: 60000,
        recentPhotoProtectionDays: 0,
      };

      const result = await cleanupLRU(config, [
        'file:///old.jpg',
        'file:///new.jpg',
      ]);

      expect(result.filesDeleted).toBe(1);
      expect(result.bytesFreed).toBe(50000);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///old.jpg', {
        idempotent: true,
      });
    });

    it('should protect recent photos from deletion', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      const now = Date.now();
      const recentFile = {
        path: 'file:///recent.jpg',
        size: 50000,
        modifiedAt: now - 86400000, // 1 day ago
      };

      getAllPhotoFiles.mockResolvedValue([recentFile]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });

      const config = {
        ...DEFAULT_PHOTO_STORAGE_CONFIG,
        maxStorageBytes: 10000,
        cleanupThresholdBytes: 10000,
        recentPhotoProtectionDays: 7, // Protect 7 days
      };

      const result = await cleanupLRU(config, ['file:///recent.jpg']);

      expect(result.filesDeleted).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should ignore protection period in aggressive mode', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      const now = Date.now();
      const recentFile = {
        path: 'file:///recent.jpg',
        size: 50000,
        modifiedAt: now - 86400000,
      };

      getAllPhotoFiles.mockResolvedValue([recentFile]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const config = {
        ...DEFAULT_PHOTO_STORAGE_CONFIG,
        maxStorageBytes: 10000,
        cleanupThresholdBytes: 10000,
        recentPhotoProtectionDays: 7,
      };

      const result = await cleanupLRU(config, ['file:///recent.jpg'], true);

      expect(result.filesDeleted).toBe(1);
    });

    it('should handle cleanup errors gracefully', async () => {
      const { getAllPhotoFiles } = photoStorageService as jest.Mocked<
        typeof photoStorageService
      >;

      getAllPhotoFiles.mockRejectedValue(new Error('Storage error'));

      const result = await cleanupLRU(DEFAULT_PHOTO_STORAGE_CONFIG, []);

      expect(result).toEqual({
        filesDeleted: 0,
        bytesFreed: 0,
        durationMs: expect.any(Number),
        orphansRemoved: 0,
      });
    });

    it('should handle file deletion errors and continue', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      const now = Date.now();
      const file1 = {
        path: 'file:///file1.jpg',
        size: 50000,
        modifiedAt: now - 100000,
      };
      const file2 = {
        path: 'file:///file2.jpg',
        size: 50000,
        modifiedAt: now - 200000,
      };

      getAllPhotoFiles.mockResolvedValue([file1, file2]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });
      (FileSystem.deleteAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      const config = {
        ...DEFAULT_PHOTO_STORAGE_CONFIG,
        maxStorageBytes: 10000,
        cleanupThresholdBytes: 10000,
        recentPhotoProtectionDays: 0,
      };

      const result = await cleanupLRU(config, [
        'file:///file1.jpg',
        'file:///file2.jpg',
      ]);

      // Only file2 should be deleted (file1 failed)
      expect(result.filesDeleted).toBe(1);
      expect(result.bytesFreed).toBe(50000);
    });
  });

  describe('initializeJanitor', () => {
    it('should schedule cleanup after delay', async () => {
      const { getAllPhotoFiles, detectOrphans, cleanupOrphans } =
        photoStorageService as jest.Mocked<typeof photoStorageService>;

      getAllPhotoFiles.mockResolvedValue([]);
      detectOrphans.mockResolvedValue([]);
      cleanupOrphans.mockResolvedValue({
        deletedCount: 0,
        deletedPaths: [],
      });

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      initializeJanitor(DEFAULT_PHOTO_STORAGE_CONFIG, []);

      // Fast-forward time to trigger cleanup
      await jest.advanceTimersByTimeAsync(5000);

      // Wait for async cleanup to complete
      await Promise.resolve();

      expect(cleanupOrphans).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Janitor cleanup completed:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle initialization errors gracefully', async () => {
      const { getAllPhotoFiles } = photoStorageService as jest.Mocked<
        typeof photoStorageService
      >;

      getAllPhotoFiles.mockRejectedValue(new Error('Init failed'));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      initializeJanitor(DEFAULT_PHOTO_STORAGE_CONFIG, []);

      await jest.advanceTimersByTimeAsync(5000);
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LRU cleanup failed:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
