/**
 * Sync Worker Tests
 */

import { synchronize } from '@nozbe/watermelondb/sync';

import { ConsentService } from '@/lib/privacy/consent-service';
import { ConsentRequiredError } from '@/lib/privacy/errors';

import { SyncWorker } from '../sync-worker';
import type { SyncPullResponse } from '../types';

// Mock WatermelonDB synchronize
jest.mock('@nozbe/watermelondb/sync', () => ({
  synchronize: jest.fn(),
}));

const mockSynchronize = synchronize as jest.MockedFunction<typeof synchronize>;

describe('SyncWorker', () => {
  let mockDatabase: any;
  let syncWorker: SyncWorker;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabase = {
      get: jest.fn(),
    };
    await ConsentService.setConsent('cloudProcessing', true);
    syncWorker = new SyncWorker(mockDatabase);
  });

  describe('getStatus', () => {
    it('returns initial status', () => {
      const status = syncWorker.getStatus();

      expect(status.state).toBe('idle');
      expect(status.retryAttempt).toBe(0);
      expect(status.pendingChanges).toBe(0);
    });
  });

  describe('synchronize', () => {
    it('successfully syncs data', async () => {
      const pullResponse: SyncPullResponse = {
        serverTimestamp: Date.now(),
        changes: {
          ph_ec_readings: [
            { id: 'r1', ph: 6.0, ec_25c: 1.5, server_revision: 1 },
          ],
        },
      };

      const pullEndpoint = jest.fn().mockResolvedValue(pullResponse);
      const pushEndpoint = jest.fn().mockResolvedValue(undefined);

      mockSynchronize.mockImplementation(async ({ pullChanges }) => {
        await pullChanges({
          lastPulledAt: undefined,
          schemaVersion: 1,
          migration: null,
        });
      });

      await syncWorker.synchronize({ pullEndpoint, pushEndpoint });

      const status = syncWorker.getStatus();
      expect(status.state).toBe('idle');
      expect(status.lastSyncAt).toBeDefined();
      expect(status.lastError).toBeUndefined();
    });

    it('calls onSyncSuccess callback', async () => {
      const onSuccess = jest.fn();
      syncWorker.on('success', onSuccess);

      const pullResponse: SyncPullResponse = {
        serverTimestamp: Date.now(),
        changes: {},
      };

      const pullEndpoint = jest.fn().mockResolvedValue(pullResponse);
      const pushEndpoint = jest.fn().mockResolvedValue(undefined);

      mockSynchronize.mockResolvedValue();

      await syncWorker.synchronize({ pullEndpoint, pushEndpoint });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('calls onSyncError callback on failure', async () => {
      const onError = jest.fn();

      const workerWithNoRetries = new SyncWorker(mockDatabase, {
        maxRetries: 0,
        baseDelayMs: 10,
        maxDelayMs: 100,
        enableLogging: false,
      });

      workerWithNoRetries.on('error', onError);

      const pullEndpoint = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const pushEndpoint = jest.fn();

      mockSynchronize.mockRejectedValue(new Error('Network error'));

      await expect(
        workerWithNoRetries.synchronize({ pullEndpoint, pushEndpoint })
      ).rejects.toThrow('Network error');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('retries on failure', async () => {
      const pullResponse: SyncPullResponse = {
        serverTimestamp: Date.now(),
        changes: {},
      };

      const pullEndpoint = jest.fn().mockResolvedValue(pullResponse);
      const pushEndpoint = jest.fn();

      // Fail twice, then succeed
      mockSynchronize
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce(undefined);

      const workerWithRetries = new SyncWorker(mockDatabase, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        enableLogging: false,
      });

      await workerWithRetries.synchronize({ pullEndpoint, pushEndpoint });

      expect(mockSynchronize).toHaveBeenCalledTimes(3);
    });

    it('sets error state after max retries', async () => {
      const pullEndpoint = jest.fn();
      const pushEndpoint = jest.fn();

      mockSynchronize.mockRejectedValue(new Error('Always fails'));

      const workerWithRetries = new SyncWorker(mockDatabase, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        enableLogging: false,
      });

      await expect(
        workerWithRetries.synchronize({ pullEndpoint, pushEndpoint })
      ).rejects.toThrow('Always fails');

      const status = workerWithRetries.getStatus();
      expect(status.state).toBe('error');
      expect(status.lastError).toBe('Always fails');
    });

    it('throws ConsentRequiredError when cloudProcessing consent missing', async () => {
      await ConsentService.setConsent('cloudProcessing', false);
      const pullEndpoint = jest.fn();
      const pushEndpoint = jest.fn();

      await expect(
        syncWorker.synchronize({ pullEndpoint, pushEndpoint })
      ).rejects.toBeInstanceOf(ConsentRequiredError);
    });
  });

  describe('setOffline/setOnline', () => {
    it('updates state to offline', () => {
      syncWorker.setOffline();

      const status = syncWorker.getStatus();
      expect(status.state).toBe('offline');
    });

    it('updates state back to idle when online', () => {
      syncWorker.setOffline();
      syncWorker.setOnline();

      const status = syncWorker.getStatus();
      expect(status.state).toBe('idle');
    });

    it('does not change state from error to idle', async () => {
      const pullEndpoint = jest.fn();
      const pushEndpoint = jest.fn();

      mockSynchronize.mockRejectedValue(new Error('Fail'));

      const workerWithRetries = new SyncWorker(mockDatabase, {
        maxRetries: 0,
        enableLogging: false,
      });

      // Create error state
      await expect(
        workerWithRetries.synchronize({ pullEndpoint, pushEndpoint })
      ).rejects.toThrow();

      workerWithRetries.setOnline();
      const status = workerWithRetries.getStatus();
      // Should still be error, not idle
      expect(status.state).toBe('error');
    });
  });

  describe('event callbacks', () => {
    it('registers onSyncStart callback', async () => {
      const onStart = jest.fn();
      syncWorker.on('start', onStart);

      const pullResponse: SyncPullResponse = {
        serverTimestamp: Date.now(),
        changes: {},
      };

      const pullEndpoint = jest.fn().mockResolvedValue(pullResponse);
      const pushEndpoint = jest.fn();

      mockSynchronize.mockResolvedValue();

      await syncWorker.synchronize({ pullEndpoint, pushEndpoint });

      expect(onStart).toHaveBeenCalled();
    });
  });
});
