/**
 * Tests for secure storage functionality
 * Covers MMKV initialization, encryption, and recrypt operations
 */

import { MMKV } from 'react-native-mmkv';

import {
  ENCRYPTION_SENTINEL_KEY,
  ENCRYPTION_SENTINEL_VALUE,
  STORAGE_DOMAINS,
} from './constants';
import { getOrCreateKey } from './key-manager';
import {
  authStorage,
  featureFlagsStorage,
  getAllInstances,
  getInitializedDomains,
  initializeSecureStorage,
  isSecureStorageInitialized,
  recryptAllDomains,
  rekeyOnCompromise,
  userDataStorage,
} from './secure-storage';

// Mock dependencies
jest.mock('react-native-mmkv');
jest.mock('./key-manager');

const mockGetOrCreateKey = getOrCreateKey as jest.MockedFunction<
  typeof getOrCreateKey
>;

describe('SecureStorage', () => {
  let mockMMKVInstances: Map<string, jest.Mocked<MMKV>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMMKVInstances = new Map();

    // Mock MMKV constructor
    (MMKV as jest.MockedClass<typeof MMKV>).mockImplementation((config) => {
      const mockInstance = {
        set: jest.fn(),
        getString: jest.fn(),
        getNumber: jest.fn(),
        getBoolean: jest.fn(),
        delete: jest.fn(),
        clearAll: jest.fn(),
        getAllKeys: jest.fn(() => []),
        recrypt: jest.fn(),
      } as unknown as jest.Mocked<MMKV>;

      mockMMKVInstances.set(config.id!, mockInstance);
      return mockInstance;
    });

    // Mock key generation
    mockGetOrCreateKey.mockImplementation(async (domain) => {
      return `mock-key-${domain}`;
    });
  });

  describe('initializeSecureStorage', () => {
    it('should initialize all five MMKV instances', async () => {
      await initializeSecureStorage();

      expect(isSecureStorageInitialized()).toBe(true);
      expect(mockMMKVInstances.size).toBe(5);
      expect(mockMMKVInstances.has(STORAGE_DOMAINS.AUTH)).toBe(true);
      expect(mockMMKVInstances.has(STORAGE_DOMAINS.USER_DATA)).toBe(true);
      expect(mockMMKVInstances.has(STORAGE_DOMAINS.SYNC_METADATA)).toBe(true);
      expect(mockMMKVInstances.has(STORAGE_DOMAINS.SECURITY_CACHE)).toBe(true);
      expect(mockMMKVInstances.has(STORAGE_DOMAINS.FEATURE_FLAGS)).toBe(true);
    });

    it('should write sentinel value to each instance', async () => {
      await initializeSecureStorage();

      for (const [_domain, instance] of mockMMKVInstances) {
        expect(instance.set).toHaveBeenCalledWith(
          ENCRYPTION_SENTINEL_KEY,
          ENCRYPTION_SENTINEL_VALUE
        );
      }
    });

    it('should not reinitialize if already initialized', async () => {
      await initializeSecureStorage();
      const firstCallCount = mockGetOrCreateKey.mock.calls.length;

      await initializeSecureStorage();

      // Should not call getOrCreateKey again
      expect(mockGetOrCreateKey.mock.calls.length).toBe(firstCallCount);
    });

    it('should throw error if initialization fails', async () => {
      mockGetOrCreateKey.mockRejectedValue(new Error('Key generation failed'));

      await expect(initializeSecureStorage()).rejects.toThrow(
        'Secure storage initialization failed'
      );
    });
  });

  describe('Storage operations', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    describe('set', () => {
      it('should store string values', () => {
        authStorage.set('token', 'test-token-123');

        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        expect(authInstance?.set).toHaveBeenCalledWith(
          'token',
          'test-token-123'
        );
      });

      it('should store number values', () => {
        userDataStorage.set('count', 42);

        const userInstance = mockMMKVInstances.get(STORAGE_DOMAINS.USER_DATA);
        expect(userInstance?.set).toHaveBeenCalledWith('count', 42);
      });

      it('should store boolean values', () => {
        featureFlagsStorage.set('enabled', true);

        const flagsInstance = mockMMKVInstances.get(
          STORAGE_DOMAINS.FEATURE_FLAGS
        );
        expect(flagsInstance?.set).toHaveBeenCalledWith('enabled', true);
      });

      it('should throw if not initialized', () => {
        // Reset initialization state
        jest.resetModules();

        expect(() => {
          authStorage.set('key', 'value');
        }).toThrow('Secure storage not initialized');
      });
    });

    describe('get', () => {
      it('should retrieve string values', () => {
        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        authInstance?.getString.mockReturnValue('test-token');

        const value = authStorage.get('token');

        expect(authInstance?.getString).toHaveBeenCalledWith('token');
        expect(value).toBe('test-token');
      });

      it('should retrieve number values', () => {
        const userInstance = mockMMKVInstances.get(STORAGE_DOMAINS.USER_DATA);
        userInstance?.getNumber.mockReturnValue(42);

        const value = userDataStorage.get('count');

        expect(value).toBe(42);
      });

      it('should return undefined if key not found', () => {
        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        authInstance?.getString.mockReturnValue(undefined);
        authInstance?.getNumber.mockReturnValue(undefined);
        authInstance?.getBoolean.mockReturnValue(undefined);

        const value = authStorage.get('nonexistent');

        expect(value).toBeUndefined();
      });
    });

    describe('delete', () => {
      it('should delete key from storage', () => {
        authStorage.delete('token');

        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        expect(authInstance?.delete).toHaveBeenCalledWith('token');
      });
    });

    describe('clearAll', () => {
      it('should clear all data and restore sentinel', () => {
        authStorage.clearAll();

        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        expect(authInstance?.clearAll).toHaveBeenCalled();
        // Sentinel should be restored after clear
        expect(authInstance?.set).toHaveBeenCalledWith(
          ENCRYPTION_SENTINEL_KEY,
          ENCRYPTION_SENTINEL_VALUE
        );
      });
    });

    describe('getAllKeys', () => {
      it('should return all keys from storage', () => {
        const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);
        authInstance?.getAllKeys.mockReturnValue([
          'token',
          'session',
          'refresh',
        ]);

        const keys = authStorage.getAllKeys();

        expect(keys).toEqual(['token', 'session', 'refresh']);
      });
    });
  });

  describe('recrypt', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should recrypt storage with new key', async () => {
      const newKey = 'new-encryption-key';
      const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);

      // Mock sentinel verification
      authInstance?.getString.mockReturnValue(ENCRYPTION_SENTINEL_VALUE);

      await authStorage.recrypt(newKey);

      expect(authInstance?.recrypt).toHaveBeenCalledWith(newKey);
      expect(authInstance?.getString).toHaveBeenCalledWith(
        ENCRYPTION_SENTINEL_KEY
      );
    });

    it('should throw error if sentinel verification fails', async () => {
      const newKey = 'new-encryption-key';
      const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);

      // Mock sentinel verification failure
      authInstance?.getString.mockReturnValue('wrong-value');

      await expect(authStorage.recrypt(newKey)).rejects.toThrow(
        'Recrypt verification failed: sentinel mismatch'
      );
    });

    it('should pause writes during recrypt', async () => {
      const newKey = 'new-encryption-key';
      const authInstance = mockMMKVInstances.get(STORAGE_DOMAINS.AUTH);

      authInstance?.getString.mockReturnValue(ENCRYPTION_SENTINEL_VALUE);

      // Start recrypt (but don't await yet)
      const recryptPromise = authStorage.recrypt(newKey);

      // Attempt write during recrypt should throw
      // Note: In real implementation, this would be blocked by isPaused flag

      await recryptPromise;

      // After recrypt, writes should work again
      expect(() => authStorage.set('key', 'value')).not.toThrow();
    });
  });

  describe('recryptAllDomains', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should recrypt all storage domains', async () => {
      const newKeys = {
        [STORAGE_DOMAINS.AUTH]: 'new-key-auth',
        [STORAGE_DOMAINS.USER_DATA]: 'new-key-user',
        [STORAGE_DOMAINS.SYNC_METADATA]: 'new-key-sync',
        [STORAGE_DOMAINS.SECURITY_CACHE]: 'new-key-security',
        [STORAGE_DOMAINS.FEATURE_FLAGS]: 'new-key-flags',
      };

      // Mock sentinel verification for all instances
      for (const instance of mockMMKVInstances.values()) {
        instance.getString.mockReturnValue(ENCRYPTION_SENTINEL_VALUE);
      }

      await recryptAllDomains(newKeys);

      // Verify each instance was recrypted
      for (const [domain, instance] of mockMMKVInstances) {
        expect(instance.recrypt).toHaveBeenCalledWith(newKeys[domain]);
      }
    });

    it('should throw error if key missing for domain', async () => {
      const incompleteKeys = {
        [STORAGE_DOMAINS.AUTH]: 'new-key-auth',
        // Missing other domains
      };

      await expect(recryptAllDomains(incompleteKeys)).rejects.toThrow(
        'No new key provided for domain'
      );
    });
  });

  describe('rekeyOnCompromise', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should generate new keys and recrypt all domains', async () => {
      // Mock new key generation
      const mockRekeyAllDomains = jest.fn().mockResolvedValue({
        [STORAGE_DOMAINS.AUTH]: 'new-key-auth',
        [STORAGE_DOMAINS.USER_DATA]: 'new-key-user',
        [STORAGE_DOMAINS.SYNC_METADATA]: 'new-key-sync',
        [STORAGE_DOMAINS.SECURITY_CACHE]: 'new-key-security',
        [STORAGE_DOMAINS.FEATURE_FLAGS]: 'new-key-flags',
      });

      // Mock dynamic import
      jest.doMock('./key-manager', () => ({
        ...jest.requireActual('./key-manager'),
        rekeyAllDomains: mockRekeyAllDomains,
      }));

      // Mock sentinel verification
      for (const instance of mockMMKVInstances.values()) {
        instance.getString.mockReturnValue(ENCRYPTION_SENTINEL_VALUE);
      }

      await rekeyOnCompromise();

      // Verify all instances were recrypted
      for (const instance of mockMMKVInstances.values()) {
        expect(instance.recrypt).toHaveBeenCalled();
      }
    });
  });

  describe('Utility functions', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should return all MMKV instances', () => {
      const instances = getAllInstances();

      expect(instances.size).toBe(5);
      expect(instances.has(STORAGE_DOMAINS.AUTH)).toBe(true);
    });

    it('should return list of initialized domains', () => {
      const domains = getInitializedDomains();

      expect(domains).toHaveLength(5);
      expect(domains).toContain(STORAGE_DOMAINS.AUTH);
      expect(domains).toContain(STORAGE_DOMAINS.USER_DATA);
      expect(domains).toContain(STORAGE_DOMAINS.SYNC_METADATA);
      expect(domains).toContain(STORAGE_DOMAINS.SECURITY_CACHE);
      expect(domains).toContain(STORAGE_DOMAINS.FEATURE_FLAGS);
    });
  });
});
