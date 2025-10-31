/**
 * Tests for Encryption Key Rotation
 *
 * @jest-environment node
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

import { supabase } from '@/lib/supabase';

import {
  checkKeyRotationStatus,
  cleanupOldKeys,
  getEncryptionKey,
  initializeEncryptionKey,
  rotateEncryptionKey,
  shouldShowRotationWarning,
} from '../key-rotation';

// Mock dependencies
jest.mock('expo-crypto');
jest.mock('expo-secure-store');
jest.mock('react-native-mmkv');
jest.mock('@/lib/supabase');

const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Key Rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkKeyRotationStatus', () => {
    it('should return rotation status from database', async () => {
      const mockData = [
        {
          needs_rotation: false,
          current_version: 1,
          days_until_expiry: 85,
          expires_at: new Date(
            Date.now() + 85 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockSecureStore.setItemAsync.mockResolvedValue();

      const status = await checkKeyRotationStatus();

      expect(status.needsRotation).toBe(false);
      expect(status.currentVersion).toBe(1);
      expect(status.daysUntilExpiry).toBe(85);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_key_rotation_needed'
      );
    });

    it('should return safe defaults on error', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const status = await checkKeyRotationStatus();

      expect(status.needsRotation).toBe(false);
      expect(status.currentVersion).toBe(1);
      expect(status.daysUntilExpiry).toBe(90);
    });

    it('should use cached status if checked recently', async () => {
      const recentCheck = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce(recentCheck.toISOString()) // last check
        .mockResolvedValueOnce('1'); // current version

      const status = await checkKeyRotationStatus();

      expect(status.needsRotation).toBe(false);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('rotateEncryptionKey', () => {
    it('should successfully rotate encryption key', async () => {
      const oldKey = 'old-key-hex-string';

      const newKeyHash = 'new-key-hash';

      // Mock current version
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('1') // getCurrentKeyVersion
        .mockResolvedValueOnce(oldKey); // getItemAsync for old key

      // Mock key generation
      mockCrypto.getRandomBytesAsync.mockResolvedValue(
        new Uint8Array(32).fill(1)
      );
      mockCrypto.digestStringAsync.mockResolvedValue(newKeyHash);

      // Mock SecureStore operations
      mockSecureStore.setItemAsync.mockResolvedValue();

      // Mock MMKV operations
      const mockOldStorage = {
        getAllKeys: jest.fn().mockReturnValue(['key1', 'key2']),
        getString: jest.fn().mockReturnValue('value'),
        set: jest.fn(),
        clearAll: jest.fn(),
      };

      const mockNewStorage = {
        getAllKeys: jest.fn().mockReturnValue(['key1', 'key2']),
        getString: jest.fn().mockReturnValue('value'),
        set: jest.fn(),
        clearAll: jest.fn(),
      };

      (MMKV as jest.MockedClass<typeof MMKV>).mockImplementation(
        (config: any) => {
          if (config.id === 'auth-storage') {
            return mockOldStorage as any;
          }
          return mockNewStorage as any;
        }
      );

      // Mock database rotation
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await rotateEncryptionKey();

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe(2);
      expect(result.oldVersion).toBe(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('rotate_encryption_key', {
        p_old_version: 1,
        p_new_version: 2,
        p_new_key_hash: newKeyHash,
        p_metadata: expect.objectContaining({
          device_platform: 'mobile',
        }),
      });
    });

    it('should handle rotation failure gracefully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('1');

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      mockCrypto.getRandomBytesAsync.mockResolvedValue(
        new Uint8Array(32).fill(1)
      );
      mockCrypto.digestStringAsync.mockResolvedValue('hash');

      const result = await rotateEncryptionKey();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('initializeEncryptionKey', () => {
    it('should return existing key if available', async () => {
      const existingKey = 'existing-key-hex';
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('1') // getCurrentKeyVersion
        .mockResolvedValueOnce(existingKey); // getItemAsync

      const key = await initializeEncryptionKey();

      expect(key).toBe(existingKey);
      expect(mockCrypto.getRandomBytesAsync).not.toHaveBeenCalled();
    });

    it('should generate new key if none exists', async () => {
      const keyHash = 'key-hash';

      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('1') // getCurrentKeyVersion
        .mockResolvedValueOnce(null); // no existing key

      mockCrypto.getRandomBytesAsync.mockResolvedValue(
        new Uint8Array(32).fill(1)
      );
      mockCrypto.digestStringAsync.mockResolvedValue(keyHash);
      mockSecureStore.setItemAsync.mockResolvedValue();

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const key = await initializeEncryptionKey();

      expect(key).toBeDefined();
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('rotate_encryption_key', {
        p_old_version: 0,
        p_new_version: 1,
        p_new_key_hash: keyHash,
        p_metadata: expect.objectContaining({
          initial_setup: true,
        }),
      });
    });
  });

  describe('shouldShowRotationWarning', () => {
    it('should return true when within warning period', () => {
      const status = {
        needsRotation: false,
        currentVersion: 1,
        daysUntilExpiry: 5,
        expiresAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

      expect(shouldShowRotationWarning(status)).toBe(true);
    });

    it('should return false when outside warning period', () => {
      const status = {
        needsRotation: false,
        currentVersion: 1,
        daysUntilExpiry: 30,
        expiresAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

      expect(shouldShowRotationWarning(status)).toBe(false);
    });

    it('should return false when already expired', () => {
      const status = {
        needsRotation: true,
        currentVersion: 1,
        daysUntilExpiry: 0,
        expiresAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

      expect(shouldShowRotationWarning(status)).toBe(false);
    });
  });

  describe('cleanupOldKeys', () => {
    it('should remove keys older than 2 versions', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('5'); // current version 5
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await cleanupOldKeys();

      // Should delete versions 1, 2, 3 (keep 4 and 5)
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_encryption_key_v1'
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_encryption_key_v2'
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_encryption_key_v3'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('3');
      mockSecureStore.deleteItemAsync.mockRejectedValue(
        new Error('Delete failed')
      );

      // Should not throw
      await expect(cleanupOldKeys()).resolves.not.toThrow();
    });
  });

  describe('getEncryptionKey', () => {
    it('should return current version key', async () => {
      const key = 'current-key-hex';
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('2') // getCurrentKeyVersion
        .mockResolvedValueOnce(key); // getItemAsync

      const result = await getEncryptionKey();

      expect(result).toBe(key);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        'auth_encryption_key_v2'
      );
    });

    it('should return null on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const result = await getEncryptionKey();

      expect(result).toBeNull();
    });
  });
});
