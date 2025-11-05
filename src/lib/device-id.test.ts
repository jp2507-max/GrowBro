import * as Crypto from 'expo-crypto';

import { storage } from '@/lib/storage';
import { cleanup, waitFor } from '@/lib/test-utils';

import { getDeviceId, getDeviceIdSync } from './device-id';

// Mock dependencies
jest.mock('expo-crypto');
jest.mock('@/lib/storage');

const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('device-id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  describe('getDeviceId', () => {
    test('returns existing device ID from storage', async () => {
      const existingId = 'existing-device-id';
      mockStorage.getString.mockReturnValue(existingId);

      const result = await getDeviceId();

      expect(result).toBe(existingId);
      expect(mockStorage.getString).toHaveBeenCalledWith('device_id');
      expect(mockCrypto.randomUUID).not.toHaveBeenCalled();
    });

    test('generates and persists new device ID when none exists', async () => {
      const newId = 'new-generated-id';
      mockStorage.getString.mockReturnValue(undefined);
      mockCrypto.randomUUID.mockReturnValue(newId);

      const result = await getDeviceId();

      expect(result).toBe(newId);
      expect(mockStorage.getString).toHaveBeenCalledWith('device_id');
      expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith('device_id', newId);
    });

    test('handles race condition by returning the same promise for concurrent calls', async () => {
      const newId = 'race-test-id';
      mockStorage.getString.mockReturnValue(undefined);
      mockCrypto.randomUUID.mockReturnValue(newId);

      // Start multiple concurrent calls
      const promises = [getDeviceId(), getDeviceId(), getDeviceId()];

      const results = await Promise.all(promises);

      // All should return the same ID
      expect(results[0]).toBe(newId);
      expect(results[1]).toBe(newId);
      expect(results[2]).toBe(newId);

      // UUID should only be generated once
      expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(1);
      // Storage should only be set once
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    test('clears promise cache on error and allows retry', async () => {
      mockStorage.getString.mockReturnValue(undefined);
      mockCrypto.randomUUID.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      // First call should fail
      await expect(getDeviceId()).rejects.toThrow('Crypto error');

      // Reset mock to succeed on retry
      mockCrypto.randomUUID.mockReturnValue('retry-id');

      // Second call should succeed
      const result = await getDeviceId();
      expect(result).toBe('retry-id');
      expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(2);
    });

    test('re-checks storage before creating promise to handle external writes', async () => {
      // First check returns null, second check (in promise) returns existing ID
      let callCount = 0;
      mockStorage.getString.mockImplementation(() => {
        callCount++;
        // First call (initial check): null
        // Second call (initial check after promise creation): null
        // Third call (double-check in promise): 'externally-set-id'
        if (callCount === 3) {
          return 'externally-set-id';
        }
        return undefined;
      });

      const result = await getDeviceId();

      expect(result).toBe('externally-set-id');
      expect(mockStorage.getString).toHaveBeenCalledTimes(3);
      expect(mockCrypto.randomUUID).not.toHaveBeenCalled();
      expect(mockStorage.set).not.toHaveBeenCalled();
    });
  });

  describe('getDeviceIdSync', () => {
    test('returns existing device ID from storage', () => {
      const existingId = 'existing-device-id';
      mockStorage.getString.mockReturnValue(existingId);

      const result = getDeviceIdSync();

      expect(result).toBe(existingId);
      expect(mockStorage.getString).toHaveBeenCalledWith('device_id');
    });

    test('returns temporary ID when no device ID exists', () => {
      const tempId = 'temp-uuid-123';
      mockStorage.getString.mockReturnValue(undefined);
      mockCrypto.randomUUID.mockReturnValue('uuid-123');

      const result = getDeviceIdSync();

      expect(result).toBe(tempId);
      expect(mockStorage.getString).toHaveBeenCalledWith('device_id');
      expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(1);
    });

    test('triggers async generation when no device ID exists', async () => {
      const tempId = 'temp-uuid-123';
      const finalId = 'final-uuid';
      mockStorage.getString.mockReturnValue(undefined);
      mockCrypto.randomUUID
        .mockReturnValueOnce('uuid-123')
        .mockReturnValueOnce(finalId);

      const result = getDeviceIdSync();

      expect(result).toBe(tempId);
      expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(1);

      // Flush microtasks to allow the background promise to resolve
      await jest.runAllTicks();

      // Wait for async generation to complete
      await waitFor(() => {
        expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(2);
      });

      // Check that the final ID was generated and stored
      expect(mockStorage.set).toHaveBeenCalledWith('device_id', finalId);
    });
  });
});
