import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import {
  deleteFile,
  extractExtension,
  fileExists,
  generateHashedFilename,
  getFileSize,
  hashFileContent,
} from '../photo-hash';

jest.mock('expo-crypto');
jest.mock('expo-file-system');

describe('photo-hash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashFileContent', () => {
    it('should hash file content using SHA-256', async () => {
      const mockFile = {
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
      };
      (File as jest.Mock).mockImplementation(() => mockFile);
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('abc123hash');

      const hash = await hashFileContent('file:///test.jpg');

      expect(hash).toBe('abc123hash');
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        expect.any(String),
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    });

    it('should throw error on hash failure', async () => {
      (File as jest.Mock).mockImplementation(() => {
        throw new Error('File read failed');
      });

      await expect(hashFileContent('file:///missing.jpg')).rejects.toThrow(
        'Failed to hash file content'
      );
    });
  });

  describe('generateHashedFilename', () => {
    it('should generate filename with hash and extension', () => {
      const filename = generateHashedFilename('abc123', 'jpg');
      expect(filename).toBe('abc123.jpg');
    });

    it('should handle extension with leading dot', () => {
      const filename = generateHashedFilename('abc123', '.png');
      expect(filename).toBe('abc123.png');
    });

    it('should handle uppercase extensions', () => {
      const filename = generateHashedFilename('def456', '.JPEG');
      expect(filename).toBe('def456.JPEG');
    });
  });

  describe('extractExtension', () => {
    it('should extract extension from URI', () => {
      expect(extractExtension('file:///photo.jpg')).toBe('jpg');
      expect(extractExtension('file:///photo.png')).toBe('png');
      expect(extractExtension('file:///photo.HEIC')).toBe('heic');
    });

    it('should handle URI with query params', () => {
      expect(extractExtension('file:///photo.jpg?v=123')).toBe('jpg');
    });

    it('should return jpg as fallback for no extension', () => {
      expect(extractExtension('file:///photo')).toBe('jpg');
      expect(extractExtension('file:///')).toBe('jpg');
    });

    it('should handle complex filenames', () => {
      expect(extractExtension('file:///my.photo.final.jpg')).toBe('jpg');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const mockFile = { exists: true };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const exists = await fileExists('file:///test.jpg');

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const mockFile = { exists: false };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const exists = await fileExists('file:///missing.jpg');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      (File as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const exists = await fileExists('file:///error.jpg');

      expect(exists).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('should return file size in bytes', async () => {
      const mockFile = { exists: true, size: 1024 };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const size = await getFileSize('file:///test.jpg');

      expect(size).toBe(1024);
    });

    it('should return 0 if file does not exist', async () => {
      const mockFile = { exists: false, size: 0 };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const size = await getFileSize('file:///missing.jpg');

      expect(size).toBe(0);
    });

    it('should return 0 on error', async () => {
      (File as jest.Mock).mockImplementation(() => {
        throw new Error('Access error');
      });

      const size = await getFileSize('file:///error.jpg');

      expect(size).toBe(0);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file and return true', async () => {
      const mockDelete = jest.fn();
      const mockFile = { exists: true, delete: mockDelete };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const result = await deleteFile('file:///test.jpg');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return false if file does not exist', async () => {
      const mockFile = { exists: false };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const result = await deleteFile('file:///missing.jpg');

      expect(result).toBe(false);
    });

    it('should return false on deletion error', async () => {
      const mockFile = {
        exists: true,
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };
      (File as jest.Mock).mockImplementation(() => mockFile);

      const result = await deleteFile('file:///error.jpg');

      expect(result).toBe(false);
    });
  });
});
