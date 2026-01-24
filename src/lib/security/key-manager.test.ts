/**
 * Tests for key manager functionality using expo-secure-store
 * Covers key generation, storage, retrieval, rotation, and metadata
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { ENCRYPTION_KEY_LENGTH, STORAGE_DOMAINS } from './constants';
import {
  getKeyAge,
  getOrCreateKey,
  initializeEncryptionKeys,
  keyManager,
  rekeyAllDomains,
} from './key-manager';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('expo-crypto');
jest.mock('./secure-storage', () => ({
  recryptAllDomains: jest.fn(),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;

// Import the mocked recryptAllDomains
const {
  recryptAllDomains: mockRecryptAllDomains,
} = require('./secure-storage');

describe('KeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate 32-byte key using platform CSPRNG', async () => {
      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);

      const key = await keyManager.generateKey();

      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalledWith(
        ENCRYPTION_KEY_LENGTH
      );
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      // Base64-encoded 32 bytes should be ~44 characters
      expect(key.length).toBeGreaterThan(40);
    });

    it('should throw error if key generation fails', async () => {
      mockCrypto.getRandomBytesAsync.mockRejectedValue(
        new Error('CSPRNG failure')
      );

      await expect(keyManager.generateKey()).rejects.toThrow(
        'Key generation failed'
      );
    });
  });

  describe('storeKey', () => {
    it('should store key in SecureStore', async () => {
      const keyId = 'test-domain';
      const key = 'mock-base64-key';

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await keyManager.storeKey(keyId, key);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        keyId,
        key,
        expect.objectContaining({
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })
      );

      // Should also store metadata
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    });

    it('should throw error if key storage fails', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(
        new Error('SecureStore error')
      );

      await expect(keyManager.storeKey('test', 'key')).rejects.toThrow(
        'Key storage failed'
      );
    });
  });

  describe('retrieveKey', () => {
    it('should retrieve stored key from SecureStore', async () => {
      const keyId = 'test-domain';
      const mockKey = 'mock-base64-key';

      mockSecureStore.getItemAsync.mockResolvedValue(mockKey);

      const retrievedKey = await keyManager.retrieveKey(keyId);

      expect(retrievedKey).toBe(mockKey);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        keyId,
        expect.any(Object)
      );
    });

    it('should return null if key not found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const retrievedKey = await keyManager.retrieveKey('nonexistent');

      expect(retrievedKey).toBeNull();
    });

    it('should return null if SecureStore error occurs', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(
        new Error('SecureStore error')
      );

      const retrievedKey = await keyManager.retrieveKey('test');

      expect(retrievedKey).toBeNull();
    });
  });

  describe('rotateKey', () => {
    it('should generate new key and update metadata', async () => {
      const keyId = 'test-domain';

      // Mock existing metadata retrieval
      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify({
          createdAt: Date.now() - 1000,
          rotationCount: 0,
          isHardwareBacked: true,
        })
      );

      // Mock new key generation
      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      const rotatedKey = await keyManager.rotateKey(keyId);

      expect(rotatedKey).toBeDefined();
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalled();
    });

    it('should increment rotation count in metadata', async () => {
      const keyId = 'test-domain';

      // Mock existing metadata
      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify({
          createdAt: Date.now() - 1000,
          rotationCount: 5,
          isHardwareBacked: true,
        })
      );

      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await keyManager.rotateKey(keyId);

      // Verify metadata store was called with incremented rotation count
      // Find the last metadata call since rotateKey calls storeKey which also stores metadata
      const metadataCalls = mockSecureStore.setItemAsync.mock.calls.filter(
        (call) => call[0].includes('metadata')
      );
      const lastMetadataCall = metadataCalls[metadataCalls.length - 1];

      if (lastMetadataCall) {
        const storedMetadata = JSON.parse(lastMetadataCall[1] as string);
        expect(storedMetadata.rotationCount).toBe(6);
      }
    });
  });

  describe('deleteKey', () => {
    it('should delete key from SecureStore', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await keyManager.deleteKey('test-domain');

      // Should delete key, metadata, and legacy metadata
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
    });

    it('should throw error if deletion fails', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(
        new Error('SecureStore error')
      );

      await expect(keyManager.deleteKey('test')).rejects.toThrow(
        'Key deletion failed'
      );
    });
  });

  describe('getOrCreateKey', () => {
    it('should return existing key if found', async () => {
      const domain = 'auth';
      const existingKey = 'existing-key';

      mockSecureStore.getItemAsync.mockResolvedValue(existingKey);

      const key = await getOrCreateKey(domain);

      expect(key).toBe(existingKey);
      expect(mockCrypto.getRandomBytesAsync).not.toHaveBeenCalled();
    });

    it('should generate new key if not found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      const key = await getOrCreateKey('auth');

      expect(key).toBeDefined();
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalled();
    });
  });

  describe('initializeEncryptionKeys', () => {
    it('should initialize keys for all domains', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      const keys = await initializeEncryptionKeys();

      expect(Object.keys(keys)).toHaveLength(
        Object.values(STORAGE_DOMAINS).length
      );
      expect(keys[STORAGE_DOMAINS.AUTH]).toBeDefined();
      expect(keys[STORAGE_DOMAINS.USER_DATA]).toBeDefined();
      expect(keys[STORAGE_DOMAINS.SYNC_METADATA]).toBeDefined();
      expect(keys[STORAGE_DOMAINS.SECURITY_CACHE]).toBeDefined();
      expect(keys[STORAGE_DOMAINS.FEATURE_FLAGS]).toBeDefined();
    });
  });

  describe('rekeyAllDomains', () => {
    beforeEach(() => {
      mockRecryptAllDomains.mockClear();
    });

    it('should perform safe rekey with backup and re-encryption', async () => {
      // Mock existing metadata for all domains
      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify({
          createdAt: Date.now() - 1000,
          rotationCount: 0,
          isHardwareBacked: true,
        })
      );

      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      // Mock recryptAllDomains to succeed
      mockRecryptAllDomains.mockResolvedValue(undefined);

      const newKeys = await rekeyAllDomains(mockRecryptAllDomains);

      expect(Object.keys(newKeys)).toHaveLength(
        Object.values(STORAGE_DOMAINS).length
      );
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalledTimes(
        Object.values(STORAGE_DOMAINS).length
      );
      expect(mockRecryptAllDomains).toHaveBeenCalledWith(newKeys);
    });

    it('should rollback keys on re-encryption failure', async () => {
      // Mock existing keys and metadata for all domains
      const originalKey = 'original-key-data';
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        if (key.startsWith('mmkv.')) {
          // Return the actual key for key retrieval
          return Promise.resolve(originalKey);
        } else if (key.startsWith('security:encryption:metadata_')) {
          // Return metadata for metadata retrieval
          return Promise.resolve(
            JSON.stringify({
              createdAt: Date.now() - 1000,
              rotationCount: 0,
              isHardwareBacked: true,
            })
          );
        }
        return Promise.resolve(null);
      });

      const mockRandomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
      mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      // Mock recryptAllDomains to fail
      mockRecryptAllDomains.mockRejectedValue(new Error('Recrypt failed'));

      await expect(rekeyAllDomains(mockRecryptAllDomains)).rejects.toThrow(
        'fully rolled back'
      );

      // Verify rollback was attempted - should have called setItemAsync to restore original keys
      const setItemCalls = mockSecureStore.setItemAsync.mock.calls;
      const rollbackCalls = setItemCalls.filter(
        ([key]) => key.startsWith('mmkv.') && key.endsWith('auth')
      );
      expect(rollbackCalls.length).toBeGreaterThan(0);
      expect(rollbackCalls.some(([, value]) => value === originalKey)).toBe(
        true
      );
    });
  });

  describe('getKeyAge', () => {
    it('should return key age in days', async () => {
      const domain = 'auth';
      const createdAt = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify({
          createdAt,
          rotationCount: 0,
          isHardwareBacked: true,
        })
      );

      const age = await getKeyAge(domain);

      expect(age).toBeGreaterThanOrEqual(9);
      expect(age).toBeLessThanOrEqual(11);
    });

    it('should return null if metadata unavailable', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const age = await getKeyAge('auth');

      expect(age).toBeNull();
    });
  });
});
