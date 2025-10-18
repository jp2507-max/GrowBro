/**
 * Offline Workflow Integration Tests
 *
 * Tests complete offline scenarios:
 * - Like post offline → queue → reconnect → process → confirm
 * - Comment offline → fail → retry → succeed
 * - Conflict handling (409)
 * - Target deleted (404) → drop action
 */

import { type Database } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient } from '@tanstack/react-query';

import { getCommunityApiClient } from '@/api/community/client';
import { OutboxProcessor } from '@/lib/community/outbox-processor';
import { ReconnectionHandler } from '@/lib/community/reconnection-handler';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';

// Mock dependencies
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn((fn) => fn()),
} as unknown as Database;

jest.mock('@react-native-community/netinfo');
jest.mock('@/api/community/client');
jest.mock('@/lib/watermelon', () => ({
  database: mockDatabase,
}));

const mockApiClient = {
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  createComment: jest.fn(),
  deletePost: jest.fn(),
  deleteComment: jest.fn(),
};

(getCommunityApiClient as jest.Mock).mockReturnValue(mockApiClient);

describe('Offline Workflow Integration', () => {
  let queryClient: QueryClient;
  let outboxProcessor: OutboxProcessor;
  let reconnectionHandler: ReconnectionHandler;
  let mockOutboxCollection: any;
  let netInfoListener: ((state: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    outboxProcessor = new OutboxProcessor({ database: mockDatabase });
    reconnectionHandler = new ReconnectionHandler({
      database: mockDatabase,
      queryClient,
    });

    // Mock outbox collection
    mockOutboxCollection = {
      query: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };

    (mockDatabase.get as jest.Mock).mockReturnValue(mockOutboxCollection);

    // Mock NetInfo
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      netInfoListener = listener;
      return jest.fn(); // unsubscribe function
    });
  });

  afterEach(() => {
    reconnectionHandler.stop();
    netInfoListener = null;
  });

  describe('Like Post Offline Workflow', () => {
    // TODO: Fix async timing in reconnection handler mock
    it.skip('should queue like action → reconnect → process → confirm', async () => {
      // Step 1: Create outbox entry (offline)
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

      mockApiClient.likePost.mockResolvedValue(undefined);

      // Step 2: Start reconnection handler
      reconnectionHandler.start();

      // Step 3: Simulate network coming online
      if (netInfoListener) {
        await netInfoListener({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
          details: null,
        });
      }

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify API call was made
      expect(mockApiClient.likePost).toHaveBeenCalledWith(
        'post-1',
        mockEntry.idempotencyKey,
        mockEntry.clientTxId
      );

      // Verify entry was confirmed
      expect(mockEntry.update).toHaveBeenCalled();

      // Cleanup
      reconnectionHandler.stop();
    }, 10000);

    it('should handle conflict (409) and reconcile', async () => {
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

      // Mock 409 Conflict
      const conflictError = new Error('Conflict');
      (conflictError as any).response = { status: 409 };
      (conflictError as any).serverState = {
        post_id: 'post-1',
        user_id: 'user-1',
        exists: true,
      };

      mockApiClient.likePost.mockRejectedValue(conflictError);

      await outboxProcessor.processQueue();

      // Entry should be retried (not dropped)
      expect(mockEntry.update).toHaveBeenCalled();
    });
  });

  describe('Comment Offline Workflow', () => {
    it('should queue comment → fail → retry with backoff → succeed', async () => {
      const mockEntry = createMockEntry(
        '1',
        'COMMENT',
        { post_id: 'post-1', body: 'Test comment' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // First attempt fails
      mockApiClient.createComment
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'comment-1',
          post_id: 'post-1',
          body: 'Test comment',
        });

      // First process attempt (fails)
      await outboxProcessor.processQueue();

      expect(mockEntry.retries).toBe(0); // Will be updated to 1
      expect(mockEntry.update).toHaveBeenCalled();

      // Update mock entry to reflect retry state
      mockEntry.retries = 1;
      Object.defineProperty(mockEntry, 'shouldRetry', {
        value: true,
        writable: true,
        configurable: true,
      });

      // Second process attempt (succeeds)
      await outboxProcessor.processQueue();

      expect(mockApiClient.createComment).toHaveBeenCalledTimes(2);
    });

    it('should mark as failed after max retries', async () => {
      const mockEntry = createMockEntry(
        '1',
        'COMMENT',
        { post_id: 'post-1', body: 'Test' },
        5,
        'pending'
      );

      Object.defineProperty(mockEntry, 'hasExceededMaxRetries', {
        value: true,
        writable: true,
        configurable: true,
      });

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      await outboxProcessor.processQueue();

      // Should not call API
      expect(mockApiClient.createComment).not.toHaveBeenCalled();

      // Should mark as failed
      expect(mockEntry.update).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Target Deleted (404) Handling', () => {
    it('should drop action when target is deleted', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-deleted' },
        0,
        'pending'
      );

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // Mock 404 Not Found
      const error404 = new Error('Not found');
      (error404 as any).response = { status: 404 };
      mockApiClient.likePost.mockRejectedValue(error404);

      await outboxProcessor.processQueue();

      // Entry should be destroyed (not retried)
      expect(mockEntry.destroyPermanently).toHaveBeenCalled();
      expect(mockEntry.update).not.toHaveBeenCalled();
    });
  });

  describe('Self-Echo Detection', () => {
    it('should confirm entry when matching client_tx_id received', async () => {
      const mockEntry = createMockEntry(
        '1',
        'LIKE',
        { postId: 'post-1' },
        0,
        'pending'
      );
      mockEntry.clientTxId = 'client-tx-123';

      mockOutboxCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEntry]),
      });

      // Simulate self-echo detection
      await outboxProcessor.confirmEntry('client-tx-123');

      expect(mockEntry.update).toHaveBeenCalledWith(expect.any(Function));

      // Verify status was set to confirmed
      const updateFn = (mockEntry.update as jest.Mock).mock.calls[0][0];
      const mockRecord = { status: 'pending' };
      updateFn(mockRecord);
      expect(mockRecord.status).toBe('confirmed');
    });
  });

  describe('Reconnection Flow', () => {
    // TODO: Fix async timing in reconnection handler mock
    it.skip('should process outbox before invalidating queries', async () => {
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

      mockApiClient.likePost.mockResolvedValue(undefined);

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      reconnectionHandler.start();

      if (netInfoListener) {
        await netInfoListener({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
          details: null,
        });
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify outbox was processed before queries invalidated
      expect(mockApiClient.likePost).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalled();

      // Cleanup
      reconnectionHandler.stop();
    }, 10000);
  });
});

// Helper to create mock outbox entries
function createMockEntry(
  id: string,
  op: any,
  payload: any,
  retries: number,
  status: any
): OutboxModel {
  return {
    id,
    op,
    payload,
    clientTxId: `client-tx-${id}`,
    idempotencyKey: `idem-key-${id}`,
    createdAt: new Date(),
    retries,
    nextRetryAt: undefined,
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
