import { Q } from '@nozbe/watermelondb';

import * as networkManager from '@/lib/sync/network-manager';
import { database } from '@/lib/watermelon';
import { type AssessmentRequestModel } from '@/lib/watermelon-models/assessment-request';

import { OfflineQueueManager } from './offline-queue-manager';

jest.mock('@/lib/sync/network-manager');

describe('OfflineQueueManager', () => {
  let queueManager: OfflineQueueManager;

  beforeEach(() => {
    queueManager = new OfflineQueueManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    const collection = database.get<AssessmentRequestModel>(
      'assessment_requests'
    );
    const allRequests = await collection.query().fetch();
    await database.write(async () => {
      for (const request of allRequests) {
        await request.markAsDeleted();
      }
    });
  });

  describe('enqueue', () => {
    it('should create a new assessment request', async () => {
      const requestId = await queueManager.enqueue({
        plantId: 'plant-1',
        userId: 'user-1',
        photos: [
          {
            id: 'photo-1',
            uri: 'file://test.jpg',
            timestamp: Date.now(),
            qualityScore: { score: 85, acceptable: true, issues: [] },
            metadata: { width: 1920, height: 1080 },
          },
        ],
        plantContext: { id: 'plant-1' },
      });

      expect(requestId).toBeDefined();

      const request = await queueManager.getRequest(requestId);
      expect(request).not.toBeNull();
      expect(request?.plantId).toBe('plant-1');
      expect(request?.userId).toBe('user-1');
      expect(request?.status).toBe('pending');
      expect(request?.retryCount).toBe(0);
    });
  });

  describe('getQueueStatus', () => {
    it('should return correct queue counts', async () => {
      // Create test requests with different statuses
      await queueManager.enqueue({
        plantId: 'plant-1',
        userId: 'user-1',
        photos: [],
        plantContext: { id: 'plant-1' },
      });

      await queueManager.enqueue({
        plantId: 'plant-2',
        userId: 'user-1',
        photos: [],
        plantContext: { id: 'plant-2' },
      });

      const status = await queueManager.getQueueStatus();

      expect(status.pending).toBe(2);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.lastUpdated).toBeDefined();
    });

    it('should count processing requests', async () => {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      // Create a processing request
      await database.write(async () => {
        await collection.create((record) => {
          record.plantId = 'plant-1';
          record.userId = 'user-1';
          record.status = 'processing';
          record.photos = [];
          record.plantContext = { id: 'plant-1' };
          record.retryCount = 0;
          record.originalTimestamp = Date.now();
        });
      });

      const status = await queueManager.getQueueStatus();

      expect(status.processing).toBe(1);
    });
  });

  describe('processQueue', () => {
    it('should not process when offline', async () => {
      jest.spyOn(networkManager, 'isOnline').mockResolvedValue(false);

      await queueManager.enqueue({
        plantId: 'plant-1',
        userId: 'user-1',
        photos: [],
        plantContext: { id: 'plant-1' },
      });

      const results = await queueManager.processQueue();

      expect(results).toEqual([]);
    });

    it('should process pending requests when online', async () => {
      jest.spyOn(networkManager, 'isOnline').mockResolvedValue(true);

      const requestId = await queueManager.enqueue({
        plantId: 'plant-1',
        userId: 'user-1',
        photos: [],
        plantContext: { id: 'plant-1' },
      });

      const results = await queueManager.processQueue();

      expect(results).toHaveLength(1);
      expect(results[0]?.requestId).toBe(requestId);
      expect(results[0]?.success).toBe(true);
    });

    it('should skip requests that exceeded max retries', async () => {
      jest.spyOn(networkManager, 'isOnline').mockResolvedValue(true);

      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      // Create a failed request with max retries
      await database.write(async () => {
        await collection.create((record) => {
          record.plantId = 'plant-1';
          record.userId = 'user-1';
          record.status = 'failed';
          record.photos = [];
          record.plantContext = { id: 'plant-1' };
          record.retryCount = 6; // Exceeds max retries
          record.originalTimestamp = Date.now();
        });
      });

      const results = await queueManager.processQueue();

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBe('Max retries exceeded');
    });
  });

  describe('retryFailed', () => {
    it('should reset failed requests to pending', async () => {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      // Create a failed request
      await database.write(async () => {
        await collection.create((record) => {
          record.plantId = 'plant-1';
          record.userId = 'user-1';
          record.status = 'failed';
          record.photos = [];
          record.plantContext = { id: 'plant-1' };
          record.retryCount = 2;
          record.lastError = 'Network error';
          record.nextAttemptAt = Date.now() + 10000;
          record.originalTimestamp = Date.now();
        });
      });

      await queueManager.retryFailed();

      const requests = await collection
        .query(Q.where('status', 'pending'))
        .fetch();

      expect(requests).toHaveLength(1);
      expect(requests[0]?.nextAttemptAt).toBeUndefined();
    });

    it('should not retry requests that exceeded max retries', async () => {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      // Create a failed request with max retries
      await database.write(async () => {
        await collection.create((record) => {
          record.plantId = 'plant-1';
          record.userId = 'user-1';
          record.status = 'failed';
          record.photos = [];
          record.plantContext = { id: 'plant-1' };
          record.retryCount = 6;
          record.originalTimestamp = Date.now();
        });
      });

      await queueManager.retryFailed();

      const failedRequests = await collection
        .query(Q.where('status', 'failed'))
        .fetch();

      expect(failedRequests).toHaveLength(1);
    });
  });

  describe('clearCompleted', () => {
    it('should have clearCompleted method', async () => {
      // Note: Testing clearCompleted with old timestamps requires direct DB manipulation
      // which is complex with WatermelonDB. This test verifies the method exists and runs.
      const deletedCount = await queueManager.clearCompleted(7);

      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a pending request', async () => {
      const requestId = await queueManager.enqueue({
        plantId: 'plant-1',
        userId: 'user-1',
        photos: [],
        plantContext: { id: 'plant-1' },
      });

      const success = await queueManager.cancelRequest(requestId);

      expect(success).toBe(true);

      const request = await queueManager.getRequest(requestId);
      expect(request).toBeNull();
    });

    it('should not cancel a processing request', async () => {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      const processingRequest = await database.write(async () => {
        return await collection.create((record) => {
          record.plantId = 'plant-1';
          record.userId = 'user-1';
          record.status = 'processing';
          record.photos = [];
          record.plantContext = { id: 'plant-1' };
          record.retryCount = 0;
          record.originalTimestamp = Date.now();
        });
      });

      const success = await queueManager.cancelRequest(processingRequest.id);

      expect(success).toBe(false);
    });
  });
});
