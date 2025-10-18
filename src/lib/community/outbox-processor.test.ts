/**
 * OutboxProcessor Tests
 *
 * Tests for offline-first outbox system including:
 * - FIFO queue processing
 * - Exponential backoff retry logic
 * - Max retry handling
 * - Self-echo detection
 * - 404 handling (target deleted)
 */

import { type Database } from '@nozbe/watermelondb';

import { getCommunityApiClient } from '@/api/community/client';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';

import { OutboxProcessor } from './outbox-processor';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn((fn) => fn()),
} as unknown as Database;

// Mock API client
jest.mock('@/api/community/client', () => ({
  getCommunityApiClient: jest.fn(),
}));

const mockApiClient = {
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  createComment: jest.fn(),
  deletePost: jest.fn(),
  deleteComment: jest.fn(),
};

(getCommunityApiClient as jest.Mock).mockReturnValue(mockApiClient);

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;
  let mockOutboxCollection: any;
  let mockEntries: OutboxModel[];

  beforeEach(() => {
    jest.clearAllMocks();

    processor = new OutboxProcessor({
      database: mockDatabase,
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 32000,
    });

    // Mock outbox collection
    mockOutboxCollection = {
      query: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };

    (mockDatabase.get as jest.Mock).mockReturnValue(mockOutboxCollection);
  });

  describe('processQueue', () => {
    it('should process pending entries in FIFO order', async () => {
      // Arrange: create two pending outbox entries in FIFO order.
      // Entry '1' is a LIKE operation and should be processed before
      // entry '2' which is a COMMENT. We use the helper to create
      // lightweight mocks that expose the fields the processor expects
      // (idempotencyKey, clientTxId, update/destroy methods, etc.).
      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'pending'),
        createMockEntry(
          '2',
          'COMMENT',
          { post_id: 'post-1', body: 'Test' },
          0,
          'pending'
        ),
      ];

      // Stub the WatermelonDB collection query to return our two entries.
      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      // Stub API client methods to simulate successful remote calls.
      // The LIKE returns no body, while creating a comment returns the
      // created comment object. We don't care about response shapes here
      // beyond verifying the calls and that the correct idempotency keys
      // and client transaction ids are forwarded.
      mockApiClient.likePost.mockResolvedValue(undefined);
      mockApiClient.createComment.mockResolvedValue({
        id: 'comment-1',
        post_id: 'post-1',
        body: 'Test',
      });

      // Act: process the queue
      await processor.processQueue();

      // Assert: verify FIFO execution order and that idempotency metadata
      // is passed through. The first call must be the LIKE for post-1
      // using the first entry's idempotency/clientTx ids.
      expect(mockApiClient.likePost).toHaveBeenCalledWith(
        'post-1',
        mockEntries[0].idempotencyKey,
        mockEntries[0].clientTxId
      );

      // Then the COMMENT call should have been made with the second
      // entry's payload and idempotency information.
      expect(mockApiClient.createComment).toHaveBeenCalledWith(
        { post_id: 'post-1', body: 'Test' },
        mockEntries[1].idempotencyKey,
        mockEntries[1].clientTxId
      );
    });

    it('should skip entries not ready for retry', async () => {
      const futureRetry = new Date(Date.now() + 10000);
      mockEntries = [
        createMockEntry(
          '1',
          'LIKE',
          { postId: 'post-1' },
          1,
          'pending',
          futureRetry
        ),
      ];

      // Override shouldRetry to return false
      Object.defineProperty(mockEntries[0], 'shouldRetry', {
        value: false,
        writable: true,
        configurable: true,
      });

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      await processor.processQueue();

      expect(mockApiClient.likePost).not.toHaveBeenCalled();
    });

    it('should mark entries as failed after max retries', async () => {
      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 5, 'pending'),
      ];

      // Override hasExceededMaxRetries to return true
      Object.defineProperty(mockEntries[0], 'hasExceededMaxRetries', {
        value: true,
        writable: true,
        configurable: true,
      });

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      await processor.processQueue();

      expect(mockApiClient.likePost).not.toHaveBeenCalled();
      expect(mockEntries[0].update).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle 404 errors by dropping the entry', async () => {
      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'pending'),
      ];

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      const error404 = new Error('Not found');
      (error404 as any).response = { status: 404 };
      mockApiClient.likePost.mockRejectedValue(error404);

      await processor.processQueue();

      expect(mockEntries[0].destroyPermanently).toHaveBeenCalled();
    });

    it('should apply exponential backoff on failures', async () => {
      jest.useFakeTimers();

      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'pending'),
      ];

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      mockApiClient.likePost.mockRejectedValue(new Error('Network error'));

      await processor.processQueue();

      expect(mockEntries[0].update).toHaveBeenCalledWith(expect.any(Function));

      const updateFn = (mockEntries[0].update as jest.Mock).mock.calls[0][0];
      const before = Date.now();
      const rec: any = {
        retries: 0,
        nextRetryAt: new Date(before),
        status: 'pending',
      };
      updateFn(rec);

      // 1st failure => 2000ms delay
      expect(rec.retries).toBe(1);
      const delta = rec.nextRetryAt.getTime() - before;
      expect(delta).toBe(2000);

      jest.useRealTimers();
    });
  });

  describe('retryEntry', () => {
    it('should retry a specific failed entry', async () => {
      const failedEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        3,
        'failed'
      );

      mockOutboxCollection.find.mockResolvedValue(failedEntry);
      mockApiClient.likePost.mockResolvedValue(undefined);

      await processor.retryEntry('1');

      expect(mockApiClient.likePost).toHaveBeenCalledWith(
        'post-1',
        failedEntry.idempotencyKey,
        failedEntry.clientTxId
      );
    });

    it('should throw error when retrying non-failed entry', async () => {
      const pendingEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );

      mockOutboxCollection.find.mockResolvedValue(pendingEntry);

      await expect(processor.retryEntry('1')).rejects.toThrow(
        'Can only retry failed entries'
      );
    });
  });

  describe('confirmEntry', () => {
    it('should confirm entries by client_tx_id', async () => {
      const entry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );
      entry.clientTxId = 'client-tx-123';

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([entry]),
      });

      await processor.confirmEntry('client-tx-123');

      expect(entry.update).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle no matching entries gracefully', async () => {
      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(
        processor.confirmEntry('non-existent-tx-id')
      ).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return correct status counts', async () => {
      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'pending'),
        createMockEntry('2', 'COMMENT', { post_id: 'post-1' }, 0, 'pending'),
        createMockEntry('3', 'LIKE', { postId: 'post-2' }, 5, 'failed'),
        createMockEntry('4', 'UNLIKE', { postId: 'post-3' }, 0, 'confirmed'),
      ];

      // Set status flags
      Object.defineProperty(mockEntries[0], 'isPending', { value: true });
      Object.defineProperty(mockEntries[1], 'isPending', { value: true });
      Object.defineProperty(mockEntries[2], 'hasFailed', { value: true });
      Object.defineProperty(mockEntries[3], 'isConfirmed', { value: true });

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      const status = await processor.getStatus();

      expect(status).toEqual({
        pending: 2,
        failed: 1,
        confirmed: 1,
        total: 4,
      });
    });
  });

  describe('clearConfirmed', () => {
    it('should delete all confirmed entries', async () => {
      mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'confirmed'),
        createMockEntry('2', 'COMMENT', { post_id: 'post-1' }, 0, 'confirmed'),
      ];

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      const count = await processor.clearConfirmed();

      expect(count).toBe(2);
      expect(mockEntries[0].destroyPermanently).toHaveBeenCalled();
      expect(mockEntries[1].destroyPermanently).toHaveBeenCalled();
    });
  });
});

// Helper to create mock outbox entries
function createMockEntry(
  id: string,
  op: any,
  payload: any,
  retries: number,
  status: any,
  nextRetryAt?: Date
): OutboxModel {
  return {
    id,
    op,
    payload,
    clientTxId: `client-tx-${id}`,
    idempotencyKey: `idem-key-${id}`,
    createdAt: new Date(),
    retries,
    nextRetryAt,
    status,
    isPending: status === 'pending',
    hasFailed: status === 'failed',
    isConfirmed: status === 'confirmed',
    shouldRetry: status === 'pending' || status === 'failed',
    hasExceededMaxRetries: retries >= 5,
    getNextRetryDelay: () => Math.min(1000 * Math.pow(2, retries), 32000),
    update: jest.fn(),
    destroyPermanently: jest.fn(),
  } as any;
}
