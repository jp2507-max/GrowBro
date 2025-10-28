import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { imageCacheManager } from '../image-cache-manager';
import {
  cleanupOldAssessments,
  computeFilenameKey,
  computeIntegritySha256,
  deleteAssessmentImages,
  getAssessmentStorageSize,
  storeImage,
  storeThumbnail,
} from '../image-storage';

// Mock expo modules
jest.mock('expo-crypto');
jest.mock('expo-file-system');
jest.mock('expo-secure-store');
jest.mock('../image-cache-manager');

// Mock crypto-js
const mockHmacInstances: any[] = [];

type MockedHmacInstance = {
  updateData: any;
  update: jest.Mock<MockedHmacInstance, [any]>;
  finalize: jest.Mock<
    {
      toString: jest.Mock<string, []>;
    },
    []
  >;
};

jest.mock('crypto-js', () => ({
  enc: {
    Hex: {
      parse: jest.fn((hex: string) => ({ hex, type: 'hex' })),
    },
    Base64: {
      parse: jest.fn((base64: string) => ({ base64, type: 'base64' })),
    },
  },
  algo: {
    HMAC: {
      create: jest.fn(() => {
        const instance: MockedHmacInstance = {
          updateData: null as any,
          update: jest.fn<MockedHmacInstance, [any]>((data: any) => {
            instance.updateData = data;
            return instance;
          }),
          finalize: jest.fn<
            {
              toString: jest.Mock<string, []>;
            },
            []
          >(() => ({
            toString: jest.fn<string, []>(() => {
              // Return different hashes based on the base64 data
              if (instance.updateData?.base64 === 'base64data1') {
                return 'hash1abc123def456';
              }
              if (instance.updateData?.base64 === 'base64data2') {
                return 'hash2def789ghi012';
              }
              return 'b5697411e1c36d5824669b00849a9b558f19d171fd73f21639599512ce4a3bfa';
            }),
          })),
        };
        mockHmacInstances.push(instance);
        return instance;
      }),
    },
    SHA256: 'sha256',
  },
}));

describe('Image Storage', () => {
  const mockImageUri = 'file:///test/image.jpg';
  const mockAssessmentId = 'assessment-123';
  const mockSecret =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const mockBase64 = 'base64imagedata';
  const mockHash = 'abc123def456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure the mocked expo-crypto exposes CryptoDigestAlgorithm.SHA256
    // Some test environments fully mock expo-crypto and may not include
    // the CryptoDigestAlgorithm constant; define a stable value so
    // tests that reference it (expectations) will not fail.
    (Crypto as any).CryptoDigestAlgorithm = { SHA256: 'sha256' };

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
        'Secure store error'
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

    it('should sanitize assessmentId to prevent path traversal', async () => {
      const maliciousId = '../../../etc/passwd';
      const sanitizedId = '_________etc_passwd';

      await storeImage(mockImageUri, maliciousId);

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        `file:///documents/assessments/${sanitizedId}/`,
        { intermediates: true }
      );
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

    it('should sanitize assessmentId to prevent path traversal', async () => {
      const maliciousId = '../malicious';
      const sanitizedId = '___malicious';
      const thumbnailUri = 'file:///test/thumbnail.jpg';
      const filenameKey = 'abc123';

      await storeThumbnail({
        thumbnailUri,
        assessmentId: maliciousId,
        filenameKey,
      });

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        `file:///documents/assessments/${sanitizedId}/`,
        { intermediates: true }
      );
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

    it('should sanitize assessmentId to prevent path traversal', async () => {
      const maliciousId = '../../root';
      const sanitizedId = '______root';
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
      });

      await deleteAssessmentImages(maliciousId);

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
        `file:///documents/assessments/${sanitizedId}/`
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
      const oldTime = Math.floor(
        (Date.now() - 120 * 24 * 60 * 60 * 1000) / 1000
      ); // 120 days ago in seconds
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: oldTime,
        });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'old_assessment',
      ]);

      const result = await cleanupOldAssessments(90);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('old_assessment'),
        { idempotent: true }
      );
      expect(result).toBe(1);
    });

    it('should sanitize assessmentId to prevent path traversal', async () => {
      const maliciousId = '../escape';
      const sanitizedId = '___escape';
      const oldTime = Math.floor(
        (Date.now() - 100 * 24 * 60 * 60 * 1000) / 1000
      ); // 100 days ago in seconds
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          modificationTime: oldTime,
        });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        maliciousId,
      ]);

      await cleanupOldAssessments(90);

      expect(FileSystem.getInfoAsync).toHaveBeenNthCalledWith(
        2,
        `file:///documents/assessments/${sanitizedId}/`
      );
    });

    it('should not delete recent assessments', async () => {
      const recentTime = Math.floor(
        (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
      ); // 30 days ago in seconds
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
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('getAssessmentStorageSize', () => {
    it('should return 0 if assessments directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await getAssessmentStorageSize();

      expect(result).toBe(0);
    });

    it('should recursively calculate total size of all files in subdirectories', async () => {
      // Mock assessments directory exists
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // for ASSESSMENT_DIR
        .mockResolvedValueOnce({ exists: true, isDirectory: true }) // for assessment1
        .mockResolvedValueOnce({ exists: true, size: 1000 }) // for image1.jpg
        .mockResolvedValueOnce({ exists: true, size: 2000 }) // for image2.jpg
        .mockResolvedValueOnce({ exists: true, isDirectory: true }) // for assessment2
        .mockResolvedValueOnce({ exists: true, size: 1500 }); // for image3.jpg

      (FileSystem.readDirectoryAsync as jest.Mock)
        .mockResolvedValueOnce(['assessment1', 'assessment2']) // top level
        .mockResolvedValueOnce(['image1.jpg', 'image2.jpg']) // assessment1
        .mockResolvedValueOnce(['image3.jpg']); // assessment2

      const result = await getAssessmentStorageSize();

      expect(result).toBe(4500); // 1000 + 2000 + 1500
    });
  });
});
