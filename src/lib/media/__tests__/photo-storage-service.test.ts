import { Directory, File, Paths } from 'expo-file-system';

import {
  captureAndStore,
  cleanupOrphans,
  detectOrphans,
  getAllPhotoFiles,
  getStorageInfo,
  hashAndStore,
} from '../photo-storage-service';

jest.mock('expo-file-system');
jest.mock('../exif', () => ({
  stripExifAndGeolocation: jest.fn((uri) =>
    Promise.resolve({ uri: `${uri}-stripped`, didStrip: true })
  ),
}));
jest.mock('../photo-hash', () => ({
  hashFileContent: jest.fn(() => Promise.resolve('abc123hash')),
  extractExtension: jest.fn(() => 'jpg'),
  generateHashedFilename: jest.fn((hash) => `${hash}.jpg`),
  deleteFile: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('../photo-variants', () => ({
  generatePhotoVariants: jest.fn(() =>
    Promise.resolve({
      resized: 'file:///resized.jpg',
      thumbnail: 'file:///thumb.jpg',
      metadata: { width: 4032, height: 3024, gpsStripped: true },
    })
  ),
}));

describe('photo-storage-service', () => {
  let mockDirectory: {
    exists: boolean;
    create: jest.Mock;
    list: jest.Mock;
    uri: string;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDirectory = {
      exists: true,
      create: jest.fn(),
      list: jest.fn(() => []),
      uri: 'file:///cache/harvest-photos',
    };

    (Directory as jest.Mock).mockImplementation(() => mockDirectory);
  });

  describe('captureAndStore', () => {
    it('should capture and store all three variants', async () => {
      const mockFile = {
        exists: false,
        uri: 'file:///stored.jpg',
        copy: jest.fn(),
      };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const result = await captureAndStore('file:///source.jpg');

      expect(result).toEqual({
        original: 'file:///stored.jpg',
        resized: 'file:///stored.jpg',
        thumbnail: 'file:///stored.jpg',
        metadata: { width: 4032, height: 3024, gpsStripped: true },
      });
    });

    it('should handle storage errors', async () => {
      (File as jest.Mock).mockImplementation(() => {
        throw new Error('Storage full');
      });

      await expect(captureAndStore('file:///source.jpg')).rejects.toThrow();
    });
  });

  describe('hashAndStore', () => {
    it('should hash and store file with content-addressable name', async () => {
      const mockFile = {
        exists: false,
        uri: 'file:///cache/harvest-photos/abc123hash.jpg',
        copy: jest.fn(),
      };
      const mockSourceFile = {
        copy: jest.fn(),
      };
      (File as jest.Mock)
        .mockImplementationOnce(() => mockFile) // target file
        .mockImplementationOnce(() => mockSourceFile); // source file

      const result = await hashAndStore(
        'file:///source.jpg',
        'original',
        mockDirectory as unknown as Directory
      );

      expect(result).toBe('file:///cache/harvest-photos/abc123hash.jpg');
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockFile);
    });

    it('should skip copy if file already exists (deduplication)', async () => {
      const mockFile = {
        exists: true,
        uri: 'file:///cache/harvest-photos/abc123hash.jpg',
      };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const result = await hashAndStore(
        'file:///source.jpg',
        'original',
        mockDirectory as unknown as Directory
      );

      expect(result).toBe('file:///cache/harvest-photos/abc123hash.jpg');
      // copy should not be called since file exists
    });

    it('should handle hash and store errors', async () => {
      (File as jest.Mock).mockImplementation(() => {
        throw new Error('Hash failed');
      });

      await expect(
        hashAndStore(
          'file:///source.jpg',
          'original',
          mockDirectory as unknown as Directory
        )
      ).rejects.toThrow();
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      const mockFile1 = { size: 1024 };
      const mockFile2 = { size: 2048 };
      mockDirectory.list = jest.fn(() => [mockFile1, mockFile2]);

      (
        Paths as { totalDiskSpace: number; availableDiskSpace: number }
      ).totalDiskSpace = 100000;
      (
        Paths as { totalDiskSpace: number; availableDiskSpace: number }
      ).availableDiskSpace = 50000;

      const info = await getStorageInfo();

      expect(info).toEqual({
        totalBytes: 100000,
        usedBytes: 3072,
        availableBytes: 50000,
        photoDirectory: 'file:///cache/harvest-photos',
        fileCount: 2,
      });
    });

    it('should handle empty directory', async () => {
      mockDirectory.list = jest.fn(() => []);

      const info = await getStorageInfo();

      expect(info.usedBytes).toBe(0);
      expect(info.fileCount).toBe(0);
    });

    it('should handle directory access errors', async () => {
      mockDirectory.list = jest.fn(() => {
        throw new Error('Access denied');
      });

      await expect(getStorageInfo()).rejects.toThrow();
    });
  });

  describe('detectOrphans', () => {
    it('should detect files not referenced in database', async () => {
      const mockFile1 = { uri: 'file:///photo1.jpg' };
      const mockFile2 = { uri: 'file:///photo2.jpg' };
      const mockFile3 = { uri: 'file:///photo3.jpg' };

      mockDirectory.list = jest.fn(() => [mockFile1, mockFile2, mockFile3]);

      const referencedUris = ['file:///photo1.jpg', 'file:///photo3.jpg'];

      const orphans = await detectOrphans(referencedUris);

      expect(orphans).toEqual(['file:///photo2.jpg']);
    });

    it('should return empty array if no orphans', async () => {
      const mockFile1 = { uri: 'file:///photo1.jpg' };
      mockDirectory.list = jest.fn(() => [mockFile1]);

      const orphans = await detectOrphans(['file:///photo1.jpg']);

      expect(orphans).toEqual([]);
    });

    it('should return empty array if directory does not exist', async () => {
      mockDirectory.exists = false;

      const orphans = await detectOrphans([]);

      expect(orphans).toEqual([]);
    });

    it('should handle detection errors gracefully', async () => {
      mockDirectory.list = jest.fn(() => {
        throw new Error('List failed');
      });

      const orphans = await detectOrphans([]);

      expect(orphans).toEqual([]);
    });
  });

  describe('cleanupOrphans', () => {
    it('should delete orphaned files', async () => {
      const { deleteFile } = require('../photo-hash');
      deleteFile.mockResolvedValue(true);

      const orphanPaths = ['file:///orphan1.jpg', 'file:///orphan2.jpg'];
      const deleted = await cleanupOrphans(orphanPaths);

      expect(deleted).toBe(2);
      expect(deleteFile).toHaveBeenCalledTimes(2);
    });

    it('should handle deletion failures gracefully', async () => {
      const { deleteFile } = require('../photo-hash');
      deleteFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const orphanPaths = [
        'file:///orphan1.jpg',
        'file:///orphan2.jpg',
        'file:///orphan3.jpg',
      ];
      const deleted = await cleanupOrphans(orphanPaths);

      expect(deleted).toBe(2);
    });

    it('should handle empty orphan list', async () => {
      const deleted = await cleanupOrphans([]);

      expect(deleted).toBe(0);
    });
  });

  describe('getAllPhotoFiles', () => {
    it('should return all photo files with metadata', async () => {
      const mockFile1 = {
        uri: 'file:///abc123.jpg',
        name: 'abc123.jpg',
        size: 1024,
      };
      const mockFile2 = {
        uri: 'file:///def456.jpg',
        name: 'def456.jpg',
        size: 2048,
      };

      mockDirectory.list = jest.fn(() => [mockFile1, mockFile2]);

      const files = await getAllPhotoFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        path: 'file:///abc123.jpg',
        size: 1024,
        modifiedAt: expect.any(Number),
        hash: 'abc123',
      });
      expect(files[1]).toEqual({
        path: 'file:///def456.jpg',
        size: 2048,
        modifiedAt: expect.any(Number),
        hash: 'def456',
      });
    });

    it('should return empty array if directory does not exist', async () => {
      mockDirectory.exists = false;

      const files = await getAllPhotoFiles();

      expect(files).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockDirectory.list = jest.fn(() => {
        throw new Error('List failed');
      });

      const files = await getAllPhotoFiles();

      expect(files).toEqual([]);
    });
  });
});
