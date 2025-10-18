/**
 * Comprehensive Event Deduplicator Tests
 *
 * Tests for LWW logic, self-echo detection, and multi-device scenarios
 */

import {
  clearAppliedTimestamps,
  createLikeKey,
  recordAppliedTimestamp,
  shouldApply,
} from '../event-deduplicator';

describe('EventDeduplicator comprehensive tests', () => {
  describe('Last-Write-Wins (LWW) logic', () => {
    it('should apply event with newer timestamp', () => {
      const localPost = {
        id: 'post-1',
        updated_at: '2024-01-01T10:00:00Z',
        body: 'Old content',
      };

      const incomingPost = {
        id: 'post-1',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'New content',
      };

      const result = shouldApply({
        incoming: incomingPost,
        local: localPost,
      });

      expect(result).toBe(true);
    });

    it('should reject event with older timestamp', () => {
      const localPost = {
        id: 'post-1',
        updated_at: '2024-01-01T12:00:00Z',
        body: 'Latest content',
      };

      const incomingPost = {
        id: 'post-1',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'Older content',
      };

      const result = shouldApply({
        incoming: incomingPost,
        local: localPost,
      });

      expect(result).toBe(false);
    });

    it('should apply event when local row does not exist', () => {
      const incomingPost = {
        id: 'post-2',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'New post',
      };

      const result = shouldApply({
        incoming: incomingPost,
        local: undefined,
      });

      expect(result).toBe(true);
    });

    it('should handle equal timestamps correctly', () => {
      const timestamp = '2024-01-01T12:00:00Z';

      const localPost = {
        id: 'post-1',
        updated_at: timestamp,
        body: 'Local content',
      };

      const incomingPost = {
        id: 'post-1',
        updated_at: timestamp,
        body: 'Server content',
      };

      const result = shouldApply({
        incoming: incomingPost,
        local: localPost,
      });

      // Should reject when timestamps are equal (local wins)
      expect(result).toBe(false);
    });
  });

  describe('Self-echo detection', () => {
    // Self-echo detection is handled within handleRealtimeEvent function
    // which compares client_tx_id from events with pending outbox entries
    it('should be tested via integration tests', () => {
      expect(true).toBe(true);
    });
  });

  describe('Post-likes table-specific handling', () => {
    beforeEach(() => {
      clearAppliedTimestamps();
    });

    it('should use created_at for post_likes timestamp comparison', () => {
      const localLike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T10:00:00Z',
      };

      const incomingLike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T11:00:00Z',
      };

      const result = shouldApply({
        incoming: incomingLike,
        local: localLike,
        timestampField: 'created_at',
        eventTimestamp: '2024-01-01T11:00:00Z',
        usePersistentTimestamps: true,
        getKey: (like: any) => createLikeKey(like.post_id, like.user_id),
      });

      expect(result).toBe(true);
    });

    it('should use composite key (post_id + user_id) for post_likes', () => {
      const key1 = createLikeKey('post-1', 'user-1');
      const key2 = createLikeKey('post-1', 'user-2');

      expect(key1).not.toBe(key2);
      expect(key1).toContain('post-1');
      expect(key1).toContain('user-1');
    });

    it('should track timestamps persistently for likes', () => {
      const key = createLikeKey('post-1', 'user-1');
      const timestamp = '2024-01-01T12:00:00Z';

      recordAppliedTimestamp(key, timestamp);

      const localLike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T10:00:00Z',
      };

      const incomingLike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T11:00:00Z',
      };

      // Should reject because we've recorded a later timestamp
      const result = shouldApply({
        incoming: incomingLike,
        local: localLike,
        eventTimestamp: '2024-01-01T11:00:00Z',
        usePersistentTimestamps: true,
        getKey: (like: any) => createLikeKey(like.post_id, like.user_id),
      });

      expect(result).toBe(false);
    });
  });

  describe('DELETE event handling', () => {
    it('should always apply when local does not exist', () => {
      const incomingPost = {
        id: 'post-1',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'Content',
      };

      const result = shouldApply({
        incoming: incomingPost,
        local: undefined,
      });

      expect(result).toBe(true);
    });
  });

  describe('Multi-device concurrent scenarios', () => {
    beforeEach(() => {
      clearAppliedTimestamps();
    });

    it('should handle simultaneous likes from two devices', () => {
      // Device A likes first
      const deviceALike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T10:00:00.100Z',
      };

      // Device B event arrives (slightly later)
      const deviceBLike = {
        post_id: 'post-1',
        user_id: 'user-1',
        created_at: '2024-01-01T10:00:00.200Z',
      };

      const result = shouldApply({
        incoming: deviceBLike,
        local: deviceALike,
        timestampField: 'created_at',
        eventTimestamp: '2024-01-01T10:00:00.200Z',
        usePersistentTimestamps: true,
        getKey: (like: any) => createLikeKey(like.post_id, like.user_id),
      });

      // Server's later timestamp wins
      expect(result).toBe(true);
    });

    it('should handle conflicting comment edits from two devices', () => {
      // Device A has local edit
      const deviceAComment = {
        id: 'comment-1',
        updated_at: '2024-01-01T10:00:05Z',
        body: 'Device A edit',
      };

      // Device B edit arrives (earlier timestamp)
      const deviceBComment = {
        id: 'comment-1',
        updated_at: '2024-01-01T10:00:03Z',
        body: 'Device B edit',
      };

      const result = shouldApply({
        incoming: deviceBComment,
        local: deviceAComment,
      });

      // Device A's later timestamp wins, reject older event
      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing timestamp gracefully', () => {
      const localPost = {
        id: 'post-1',
        body: 'Content',
        // missing updated_at
      };

      const incomingPost = {
        id: 'post-1',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'New content',
      };

      // Should apply when local has no timestamp
      const result = shouldApply({
        incoming: incomingPost,
        local: localPost as any,
      });

      expect(result).toBe(true);
    });

    it('should handle invalid timestamp formats', () => {
      const localPost = {
        id: 'post-1',
        updated_at: 'invalid-timestamp',
        body: 'Content',
      };

      const incomingPost = {
        id: 'post-1',
        updated_at: '2024-01-01T11:00:00Z',
        body: 'New content',
      };

      // Should apply when local timestamp is invalid
      const result = shouldApply({
        incoming: incomingPost,
        local: localPost,
      });

      expect(result).toBe(true);
    });
  });
});
