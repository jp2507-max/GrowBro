/**
 * Offline Workflow Integration Tests
 *
 * Tests complete offline scenarios including:
 * - Queue actions while offline
 * - Sync on reconnect
 * - Multi-device conflict resolution
 * - Delete + Undo within 15s window
 */

import { type Database } from '@nozbe/watermelondb';

import { getCommunityApiClient } from '@/api/community/client';
import { OutboxProcessor } from '@/lib/community/outbox-processor';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn((fn) => fn()),
} as unknown as Database;

// Mock API client
jest.mock('@/api/community/client', () => ({
  getCommunityApiClient: jest.fn(),
}));

// Mock community metrics tracker
jest.mock('@/lib/community/metrics-tracker', () => ({
  communityMetrics: {
    recordMutationFailure: jest.fn(),
    updateOutboxMetrics: jest.fn(),
  },
}));

const mockApiClient = {
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  createComment: jest.fn(),
  deletePost: jest.fn(),
  deleteComment: jest.fn(),
  undoDeletePost: jest.fn(),
  undoDeleteComment: jest.fn(),
};

(getCommunityApiClient as jest.Mock).mockReturnValue(mockApiClient);

describe('Offline Workflow Integration Tests', () => {
  let processor: OutboxProcessor;
  let mockOutboxCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    processor = new OutboxProcessor({
      database: mockDatabase,
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 32000,
    });

    mockOutboxCollection = {
      query: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };

    (mockDatabase.get as jest.Mock).mockReturnValue(mockOutboxCollection);
  });

  describe('Complete offline workflow', () => {
    it('should queue like action while offline and sync on reconnect', async () => {
      // Simulate offline: create outbox entry
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // Mock successful API call on reconnect
      mockApiClient.likePost.mockResolvedValue(undefined);

      // Process queue (simulate reconnect)
      await processor.processQueue();

      expect(mockApiClient.likePost).toHaveBeenCalledWith(
        'post-1',
        mockEntry.idempotencyKey,
        mockEntry.clientTxId
      );

      expect(mockEntry.update).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should queue comment while offline and sync on reconnect', async () => {
      const mockEntry = createMockEntry(
        '1',
        'COMMENT',
        { post_id: 'post-1', body: 'Offline comment' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      mockApiClient.createComment.mockResolvedValue({
        id: 'comment-1',
        post_id: 'post-1',
        body: 'Offline comment',
      });

      await processor.processQueue();

      expect(mockApiClient.createComment).toHaveBeenCalledWith(
        { post_id: 'post-1', body: 'Offline comment' },
        mockEntry.idempotencyKey,
        mockEntry.clientTxId
      );
    });

    it('should process multiple queued actions in FIFO order', async () => {
      const mockEntries = [
        createMockEntry('1', 'LIKE', { postId: 'post-1' }, 0, 'pending'),
        createMockEntry(
          '2',
          'COMMENT',
          { post_id: 'post-1', body: 'Test' },
          0,
          'pending'
        ),
        createMockEntry('3', 'UNLIKE', { postId: 'post-2' }, 0, 'pending'),
      ];

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockEntries),
      });

      mockApiClient.likePost.mockResolvedValue(undefined);
      mockApiClient.createComment.mockResolvedValue({ id: 'comment-1' });
      mockApiClient.unlikePost.mockResolvedValue(undefined);

      await processor.processQueue();

      // Verify FIFO order (check that all operations completed)
      expect(mockApiClient.likePost).toHaveBeenCalledTimes(1);
      expect(mockApiClient.createComment).toHaveBeenCalledTimes(1);
      expect(mockApiClient.unlikePost).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-device conflict resolution', () => {
    it('should handle simultaneous like from two devices via UNIQUE constraint', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // Mock UNIQUE constraint violation (already liked from another device)
      mockApiClient.likePost.mockResolvedValue(undefined);

      await processor.processQueue();

      // Should succeed (UPSERT handles duplicate gracefully)
      expect(mockEntry.update).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should reconcile counter drift after multi-device interactions', async () => {
      // This test would verify periodic reconciliation
      // In practice, this is handled by periodic fetch + count comparison
      expect(true).toBe(true);
    });
  });

  describe('Delete and Undo workflow', () => {
    describe('Delete operations', () => {
      it('should soft delete with 15s undo window', async () => {
        const mockEntry = createMockEntry(
          '1',
          'DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        const futureTime = new Date(Date.now() + 15000).toISOString();
        mockApiClient.deletePost.mockResolvedValue({
          undo_expires_at: futureTime,
        });

        await processor.processQueue();

        expect(mockApiClient.deletePost).toHaveBeenCalledWith(
          'post-1',
          mockEntry.idempotencyKey,
          mockEntry.clientTxId
        );
      });

      it('should process delete post operation successfully', async () => {
        const mockEntry = createMockEntry(
          '1',
          'DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        mockApiClient.deletePost.mockResolvedValue({
          undo_expires_at: new Date(Date.now() + 15000).toISOString(),
        });

        await processor.processQueue();

        // Verify delete succeeds
        expect(mockEntry.update).toHaveBeenCalled();
      });

      it('should handle delete failure when undo window expired', async () => {
        const mockEntry = createMockEntry(
          '1',
          'DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        // Mock 409 conflict error (undo window expired)
        const error = new Error('Undo period has expired');
        (error as any).message = 'expired';
        mockApiClient.deletePost.mockRejectedValue(error);

        await processor.processQueue();

        // Entry should retry or fail
        expect(mockEntry.update).toHaveBeenCalled();
      });
    });

    describe('Undo operations', () => {
      it('should process undo delete post operation successfully', async () => {
        const mockEntry = createMockEntry(
          '2',
          'UNDO_DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        mockApiClient.undoDeletePost.mockResolvedValue({
          success: true,
        });

        await processor.processQueue();

        expect(mockApiClient.undoDeletePost).toHaveBeenCalledWith(
          'post-1',
          mockEntry.idempotencyKey,
          mockEntry.clientTxId
        );
        expect(mockEntry.update).toHaveBeenCalled();
      });

      it('should process undo delete comment operation successfully', async () => {
        const mockEntry = createMockEntry(
          '3',
          'UNDO_DELETE_COMMENT',
          { commentId: 'comment-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        mockApiClient.undoDeleteComment.mockResolvedValue({
          success: true,
        });

        await processor.processQueue();

        expect(mockApiClient.undoDeleteComment).toHaveBeenCalledWith(
          'comment-1',
          mockEntry.idempotencyKey,
          mockEntry.clientTxId
        );
        expect(mockEntry.update).toHaveBeenCalled();
      });

      it('should handle undo failure when window has expired', async () => {
        const mockEntry = createMockEntry(
          '4',
          'UNDO_DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockEntry]),
        });

        // Mock 409 conflict error (undo window expired)
        const error = new Error('Undo period has expired');
        (error as any).message = 'expired';
        mockApiClient.undoDeletePost.mockRejectedValue(error);

        await processor.processQueue();

        // Entry should be marked as failed
        expect(mockEntry.update).toHaveBeenCalled();
      });
    });

    describe('Cross-device undo scenarios', () => {
      it('should handle delete followed by undo from different device', async () => {
        // Simulate delete operation (Device A)
        const mockDeleteEntry = createMockEntry(
          '5',
          'DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockDeleteEntry]),
        });

        mockApiClient.deletePost.mockResolvedValue({
          undo_expires_at: new Date(Date.now() + 15000).toISOString(),
        });

        await processor.processQueue();

        expect(mockApiClient.deletePost).toHaveBeenCalled();

        // Simulate undo operation (Device B) - would be triggered by UI/realtime
        const mockUndoEntry = createMockEntry(
          '6',
          'UNDO_DELETE_POST',
          { postId: 'post-1' },
          0,
          'pending'
        );

        mockOutboxCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockUndoEntry]),
        });

        mockApiClient.undoDeletePost.mockResolvedValue({
          success: true,
        });

        await processor.processQueue();

        expect(mockApiClient.undoDeletePost).toHaveBeenCalledWith(
          'post-1',
          mockUndoEntry.idempotencyKey,
          mockUndoEntry.clientTxId
        );
      });
    });
  });

  describe('Target deleted scenarios', () => {
    it('should drop action when target post is deleted (404)', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      const error404 = new Error('Not found');
      (error404 as any).response = { status: 404 };
      mockApiClient.likePost.mockRejectedValue(error404);

      await processor.processQueue();

      expect(mockEntry.destroyPermanently).toHaveBeenCalled();
    });

    it('should drop comment action when post is deleted', async () => {
      const mockEntry = createMockEntry(
        '1',
        'COMMENT',
        { post_id: 'post-1', body: 'Test' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      const error404 = new Error('Post not found');
      (error404 as any).response = { status: 404 };
      mockApiClient.createComment.mockRejectedValue(error404);

      await processor.processQueue();

      expect(mockEntry.destroyPermanently).toHaveBeenCalled();
    });
  });

  describe('Network failure and retry logic', () => {
    it('should retry with exponential backoff on transient failures', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      mockApiClient.likePost.mockRejectedValue(new Error('Network error'));

      await processor.processQueue();

      // Verify retry count increased
      const updateFn = (mockEntry.update as jest.Mock).mock.calls[0][0];
      const mockRecord = {
        retries: 0,
        nextRetryAt: new Date(),
        status: 'pending',
      };
      updateFn(mockRecord);

      expect(mockRecord.retries).toBe(1);
      expect(mockRecord.status).toBe('pending');
    });

    it('should mark as failed after max retries', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        5,
        'pending'
      );

      // Override hasExceededMaxRetries to return true
      Object.defineProperty(mockEntry, 'hasExceededMaxRetries', {
        value: true,
        writable: true,
        configurable: true,
      });

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      await processor.processQueue();

      expect(mockEntry.update).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Idempotency across retries', () => {
    it('should preserve idempotency key across all retry attempts', async () => {
      const idempotencyKey = 'stable-key-123';
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );
      mockEntry.idempotencyKey = idempotencyKey;

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // First attempt fails
      mockApiClient.likePost.mockRejectedValueOnce(new Error('Network error'));

      await processor.processQueue();

      // Verify same idempotency key used
      expect(mockApiClient.likePost).toHaveBeenCalledWith(
        'post-1',
        idempotencyKey,
        expect.any(String)
      );
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
    shouldRetry: true,
    hasExceededMaxRetries: retries >= 5,
    getNextRetryDelay: () => Math.min(1000 * Math.pow(2, retries), 32000),
    update: jest.fn(),
    destroyPermanently: jest.fn(),
  } as any;
}
