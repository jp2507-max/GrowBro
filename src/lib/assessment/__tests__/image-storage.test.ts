import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { imageCacheManager } from '../image-cache-manager';
import {
  cleanupOldAssessments,
  computeFilenameKey,
  computeIntegritySha256,
  deleteAssessmentImages,
  storeImage,
  storeThumbnail,
} from '../image-storage';

// Mock expo modules
jest.mock('expo-crypto');
jest.mock('expo-file-system');
jest.mock('expo-secure-store');
jest.mock('../image-cache-manager');

describe('Image Storage', () => {
  const mockImageUri = 'file:///test/image.jpg';
  const mockAssessmentId = 'assessment-123';
  const mockSecret =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const mockBase64 = 'base64imagedata';
  const mockHash = 'abc123def456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock FileSystem.documentDirectory
    Object.defineProperty(FileSystem, 'documentDirectory', {
      value: 'file:///documents/',
      writable: true,
    });

    // Default mocks
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockSecret);
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(mockHash);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 1024000,
    });
    (imageCacheManager.add as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Secret Management', () => {
    it('should retrieve existing secret from secure store', async () => {
      await computeFilenameKey(mockImageUri);

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        'assessment_filename_secret'
      );
    });

    it('should generate and store new secret if none exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockRandomBytes = new Uint8Array([1, 2, 3, 4]);
      (Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(
        mockRandomBytes
      );

      await computeFilenameKey(mockImageUri);

      expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'assessment_filename_secret',
        expect.any(String)
      );
    });

    it('should throw error when secure storage fails', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error('Secure store error')
      );

      await expect(computeFilenameKey(mockImageUri)).rejects.toThrow(
        'Failed to initialize secure storage'
      );
    });
  });

  describe('computeIntegritySha256', () => {
    it('should compute SHA-256 hash of image bytes', async () => {
      const result = await computeIntegritySha256(mockImageUri);

      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(mockImageUri, {
        encoding: 'base64',
      });
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        mockBase64
      );
      expect(result).toBe(mockHash);
    });

    it('should throw error when hashing fails', async () => {
      (Crypto.digestStringAsync as jest.Mock).mockRejectedValue(
        new Error('Hash failed')
      );

      await expect(computeIntegritySha256(mockImageUri)).rejects.toThrow(
        'Failed to compute integrity hash'
      );
    });
  });

  describe('computeFilenameKey', () => {
    it('should compute HMAC-SHA256 filename key', async () => {
      const result = await computeFilenameKey(mockImageUri);

      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(mockImageUri, {
        encoding: 'base64',
      });
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should produce different keys for different images', async () => {
      const image1Uri = 'file:///test/image1.jpg';
      const image2Uri = 'file:///test/image2.jpg';

      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce('base64data1')
        .mockResolvedValueOnce('base64data2');

      const key1 = await computeFilenameKey(image1Uri);
      const key2 = await computeFilenameKey(image2Uri);

      expect(key1).not.toBe(key2);
    });

    it('should throw error when HMAC computation fails', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('Read failed')
      );

      await expect(computeFilenameKey(mockImageUri)).rejects.toThrow(
        'Failed to compute filename key'
      );
    });
  });

  describe('storeImage', () => {
    it('should store image with content-addressable filename', async () => {
      const result = await storeImage(mockImageUri, mockAssessmentId);

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        `file:///documents/assessments/${mockAssessmentId}/`,
        { intermediates: true }
      );

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: mockImageUri,
        to: expect.stringContaining('.jpg'),
      });

      expect(result).toHaveProperty('filenameKey');
      expect(result).toHaveProperty('integritySha256');
      expect(result).toHaveProperty('storedUri');
    });

    it('should add image to cache manager', async () => {
      const createdAt = Date.now();
      await storeImage(mockImageUri, mockAssessmentId, createdAt);

      expect(imageCacheManager.add).toHaveBeenCalledWith({
        uri: expect.any(String),
        size: 1024000,
        assessmentId: mockAssessmentId,
        createdAt,
      });
    });

    it('should throw error when storage fails', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('Copy failed')
      );

      await expect(storeImage(mockImageUri, mockAssessmentId)).rejects.toThrow(
        'Failed to store image'
      );
    });
  });

  describe('storeThumbnail', () => {
    it('should store thumbnail with filename key suffix', async () => {
      const thumbnailUri = 'file:///test/thumbnail.jpg';
      const filenameKey = 'abc123';

      const result = await storeThumbnail({
        thumbnailUri,
        assessmentId: mockAssessmentId,
        filenameKey,
      });

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: thumbnailUri,
        to: expect.stringContaining(`${filenameKey}_thumb.jpg`),
      });

      expect(result).toContain('_thumb.jpg');
    });

    it('should add thumbnail to cache manager', async () => {
      const createdAt = Date.now();
      await storeThumbnail({
        thumbnailUri: 'file:///test/thumb.jpg',
        assessmentId: mockAssessmentId,
        filenameKey: 'key123',
        createdAt,
      });

      expect(imageCacheManager.add).toHaveBeenCalledWith({
        uri: expect.any(String),
        size: 1024000,
        assessmentId: mockAssessmentId,
        createdAt,
      });
    });

    it('should throw error when thumbnail storage fails', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('Copy failed')
      );

      await expect(
        storeThumbnail({
          thumbnailUri: 'file:///test/thumb.jpg',
          assessmentId: mockAssessmentId,
          filenameKey: 'key123',
        })
      ).rejects.toThrow('Failed to store thumbnail');
    });
  });

  describe('deleteAssessmentImages', () => {
    it('should remove from cache and delete directory', async () => {
      (imageCacheManager.removeAssessment as jest.Mock).mockResolvedValue(
        1024000
      );
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
      });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await deleteAssessmentImages(mockAssessmentId);

      expect(imageCacheManager.removeAssessment).toHaveBeenCalledWith(
        mockAssessmentId
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining(mockAssessmentId),
        { idempotent: true }
      );
    });

    it('should not throw if directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      await expect(
        deleteAssessmentImages(mockAssessmentId)
      ).resolves.not.toThrow();
    });

    it('should not throw if deletion fails', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(
        deleteAssessmentImages(mockAssessmentId)
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupOldAssessments', () => {
    it('should delete assessments older than retention period', async () => {
      const oldTime = Date.now() / 1000 - 100 * 24 * 60 * 60; // 100 days ago
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: oldTime,
        });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'old-assessment',
      ]);

      const result = await cleanupOldAssessments(90);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('old-assessment'),
        { idempotent: true }
      );
      expect(result).toBe(1);
    });

    it('should not delete recent assessments', async () => {
      const recentTime = Date.now() / 1000 - 30 * 24 * 60 * 60; // 30 days ago
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: recentTime,
        });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'recent-assessment',
      ]);

      const result = await cleanupOldAssessments(90);

      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should return 0 if assessments directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await cleanupOldAssessments(90);

      expect(result).toBe(0);
    });
  });
});
