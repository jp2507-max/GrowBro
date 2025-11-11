import * as FileSystem from 'expo-file-system';

import * as photoHash from '../photo-hash';
import {
  captureAndStore,
  cleanupOrphans,
  detectOrphans,
  getAllPhotoFiles,
  getStorageInfo,
  hashAndStore,
} from '../photo-storage-service';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(() => []),
  writeAsStringAsync: jest.fn(),
  copyAsync: jest.fn(),
  getTotalDiskCapacityAsync: jest.fn(() => Promise.resolve(1000000000)),
  getFreeDiskStorageAsync: jest.fn(() => Promise.resolve(500000000)),
}));

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
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string) =>
      Promise.resolve({
        exists: true,
        uri,
        size: 1000,
        modificationTime: Date.now() / 1000,
        isDirectory: uri.endsWith('/'),
      })
    );
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('captureAndStore', () => {
    it('should capture and store all three variants', async () => {
      // Mock getInfoAsync to return exists: false for target files
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri.includes('abc123hash.jpg')) {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({
            exists: true,
            isDirectory: uri.endsWith('/'),
          });
        }
      );

      const result = await captureAndStore('file:///source.jpg');

      expect(result).toEqual({
        original: 'file:///cache/harvest-photos/abc123hash.jpg',
        resized: 'file:///cache/harvest-photos/abc123hash.jpg',
        thumbnail: 'file:///cache/harvest-photos/abc123hash.jpg',
        metadata: { width: 4032, height: 3024, gpsStripped: true },
      });
    });

    it('should handle storage errors', async () => {
      // Ensure target files don't already exist so copyAsync is attempted
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri.includes('abc123hash.jpg')) {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({
            exists: true,
            isDirectory: uri.endsWith('/'),
          });
        }
      );

      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('Storage full')
      );

      await expect(captureAndStore('file:///source.jpg')).rejects.toThrow(
        'Storage full'
      );
    });
  });

  describe('hashAndStore', () => {
    it('should hash and store file with content-addressable name', async () => {
      // Ensure target file does not exist to force copy
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/abc123hash.jpg') {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({
            exists: true,
            isDirectory: uri.endsWith('/'),
          });
        }
      );

      const result = await hashAndStore(
        'file:///source.jpg',
        'original',
        'file:///cache/harvest-photos/'
      );

      expect(result).toBe('file:///cache/harvest-photos/abc123hash.jpg');
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///source.jpg',
        to: 'file:///cache/harvest-photos/abc123hash.jpg',
      });
    });

    it('should skip copy if file already exists (deduplication)', async () => {
      // Mock getInfoAsync to return exists: true for target file
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri.includes('abc123hash.jpg')) {
            return Promise.resolve({ exists: true });
          }
          return Promise.resolve({
            exists: true,
            isDirectory: uri.endsWith('/'),
          });
        }
      );

      const result = await hashAndStore(
        'file:///source.jpg',
        'original',
        'file:///cache/harvest-photos/'
      );

      expect(result).toBe('file:///cache/harvest-photos/abc123hash.jpg');
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });

    it('should handle hash and store errors', async () => {
      // Ensure target file does not exist so copy is attempted
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/abc123hash.jpg') {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({
            exists: true,
            isDirectory: uri.endsWith('/'),
          });
        }
      );

      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('Copy failed')
      );

      await expect(
        hashAndStore(
          'file:///source.jpg',
          'original',
          'file:///cache/harvest-photos/'
        )
      ).rejects.toThrow('Copy failed');
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      // Mock readDirectoryAsync to return file names
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'file1.jpg',
        'file2.jpg',
      ]);
      // Mock getInfoAsync for individual files
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: true, isDirectory: true });
          }
          if (uri.includes('file1.jpg')) {
            return Promise.resolve({
              exists: true,
              isDirectory: false,
              size: 1024,
            });
          }
          if (uri.includes('file2.jpg')) {
            return Promise.resolve({
              exists: true,
              isDirectory: false,
              size: 2048,
            });
          }
          return Promise.resolve({ exists: true, isDirectory: false, size: 0 });
        }
      );

      const info = await getStorageInfo();

      expect(info).toEqual({
        totalBytes: 1000000000,
        usedBytes: 3072,
        availableBytes: 500000000,
        photoDirectory: 'file:///cache/harvest-photos/',
        fileCount: 2,
      });
    });

    it('should handle empty directory', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);

      const info = await getStorageInfo();

      expect(info.usedBytes).toBe(0);
      expect(info.fileCount).toBe(0);
    });

    it('should handle directory access errors', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(getStorageInfo()).rejects.toThrow();
    });
  });

  describe('detectOrphans', () => {
    it('should detect files not referenced in database', async () => {
      // Simulate directory contents as filenames (production uses names)
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'photo1.jpg',
        'photo2.jpg',
        'photo3.jpg',
      ]);

      // Mock getInfoAsync for directory and files
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: true, isDirectory: true });
          }
          if (
            uri.endsWith('photo1.jpg') ||
            uri.endsWith('photo2.jpg') ||
            uri.endsWith('photo3.jpg')
          ) {
            return Promise.resolve({ exists: true, isDirectory: false });
          }
          return Promise.resolve({ exists: false });
        }
      );

      const dir = 'file:///cache/harvest-photos/';
      const referencedUris = [dir + 'photo1.jpg', dir + 'photo3.jpg'];

      const orphans = await detectOrphans(referencedUris);

      expect(orphans).toEqual([dir + 'photo2.jpg']);
    });

    it('should return empty array if no orphans', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'photo1.jpg',
      ]);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: true, isDirectory: true });
          }
          if (uri.endsWith('photo1.jpg')) {
            return Promise.resolve({ exists: true, isDirectory: false });
          }
          return Promise.resolve({ exists: false });
        }
      );

      const dir = 'file:///cache/harvest-photos/';
      const orphans = await detectOrphans([dir + 'photo1.jpg']);

      expect(orphans).toEqual([]);
    });

    it('should return empty array if directory does not exist', async () => {
      // Simulate directory missing
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({ exists: false });
        }
      );

      const orphans = await detectOrphans([]);

      expect(orphans).toEqual([]);
    });

    it('should handle detection errors gracefully', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(() => {
        throw new Error('List failed');
      });

      const orphans = await detectOrphans([]);

      expect(orphans).toEqual([]);
    });
  });

  describe('cleanupOrphans', () => {
    it('should delete orphaned files', async () => {
      const { deleteFile } = photoHash as jest.Mocked<typeof photoHash>;
      deleteFile.mockResolvedValue(true);

      const orphanPaths = ['file:///orphan1.jpg', 'file:///orphan2.jpg'];
      const result = await cleanupOrphans(orphanPaths);

      expect(result.deletedCount).toBe(2);
      expect(result.deletedPaths).toEqual(orphanPaths);
      expect(deleteFile).toHaveBeenCalledTimes(2);
    });

    it('should handle deletion failures gracefully', async () => {
      const { deleteFile } = photoHash as jest.Mocked<typeof photoHash>;
      deleteFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const orphanPaths = [
        'file:///orphan1.jpg',
        'file:///orphan2.jpg',
        'file:///orphan3.jpg',
      ];
      const result = await cleanupOrphans(orphanPaths);

      expect(result.deletedCount).toBe(2);
      expect(result.deletedPaths).toEqual([orphanPaths[0], orphanPaths[2]]);
    });

    it('should handle empty orphan list', async () => {
      const result = await cleanupOrphans([]);

      expect(result.deletedCount).toBe(0);
      expect(result.deletedPaths).toEqual([]);
    });
  });

  describe('getAllPhotoFiles', () => {
    it('should return all photo files with metadata', async () => {
      // Simulate directory with two files
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'abc123.jpg',
        'def456.jpg',
      ]);

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: true, isDirectory: true });
          }
          if (uri.endsWith('abc123.jpg')) {
            return Promise.resolve({
              exists: true,
              isDirectory: false,
              size: 1024,
              modificationTime: Date.now() / 1000,
            });
          }
          if (uri.endsWith('def456.jpg')) {
            return Promise.resolve({
              exists: true,
              isDirectory: false,
              size: 2048,
              modificationTime: Date.now() / 1000,
            });
          }
          return Promise.resolve({ exists: false });
        }
      );

      const files = await getAllPhotoFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        path: 'file:///cache/harvest-photos/abc123.jpg',
        size: 1024,
        modifiedAt: expect.any(Number),
        hash: 'abc123',
      });
      expect(files[1]).toEqual({
        path: 'file:///cache/harvest-photos/def456.jpg',
        size: 2048,
        modifiedAt: expect.any(Number),
        hash: 'def456',
      });
    });

    it('should return empty array if directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (uri: string) => {
          if (uri === 'file:///cache/harvest-photos/') {
            return Promise.resolve({ exists: false });
          }
          return Promise.resolve({ exists: false });
        }
      );

      const files = await getAllPhotoFiles();

      expect(files).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(() => {
        throw new Error('List failed');
      });

      const files = await getAllPhotoFiles();

      expect(files).toEqual([]);
    });
  });
});
