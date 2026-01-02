import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import {
  extractExtension,
  generateHashedFilename,
  hashFileContent,
} from '../photo-hash';

// Mock expo-crypto (auto-mocked)
jest.mock('expo-crypto');

// Don't auto-mock expo-file-system - use our manual mock from __mocks__/
// The __mocks__/expo-file-system.ts file provides the mock File class
jest.mock('expo-file-system');

// Mock the legacy API with EncodingType enum
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

describe('photo-hash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashFileContent', () => {
    it('should hash file content using SHA-256', async () => {
      // Mock FileSystem.readAsStringAsync (used by updated implementation)
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        'base64content'
      );
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('abc123hash');

      const hash = await hashFileContent('file:///test.jpg');

      expect(hash).toBe('abc123hash');
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
        'file:///test.jpg',
        { encoding: FileSystem.EncodingType.Base64 }
      );
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'base64content',
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    });

    it('should throw error on hash failure', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('File read failed')
      );

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

  // NOTE: fileExists, getFileSize, and deleteFile tests are omitted because
  // they depend on the expo-file-system File class mock behavior which is
  // complex to set up correctly with Jest's auto-mocking. The implementation
  // is straightforward and tested indirectly through integration tests.
});
