import type { Post, PostLike, RealtimeEvent } from '@/types/community';

import {
  clearAppliedTimestamps,
  createLikeKey,
  type EventHandlerOptions,
  getLastAppliedTimestamp,
  getLikeKey,
  handleRealtimeEvent,
  recordAppliedTimestamp,
  shouldApply,
} from '../event-deduplicator';

describe('event-deduplicator', () => {
  beforeEach(() => {
    clearAppliedTimestamps();
  });

  describe('shouldApply', () => {
    it('should allow apply when no local row exists', () => {
      const incoming = { id: '1', updated_at: '2024-01-01T00:00:00Z' };
      expect(shouldApply({ incoming, local: undefined })).toBe(true);
    });

    it('should drop stale events with older updated_at', () => {
      const incoming = { id: '1', updated_at: '2024-01-01T00:00:00Z' };
      const local = { id: '1', updated_at: '2024-01-02T00:00:00Z' };
      expect(shouldApply({ incoming, local })).toBe(false);
    });

    it('should apply events with newer updated_at', () => {
      const incoming = { id: '1', updated_at: '2024-01-03T00:00:00Z' };
      const local = { id: '1', updated_at: '2024-01-02T00:00:00Z' };
      expect(shouldApply({ incoming, local })).toBe(true);
    });

    it('should handle custom timestamp field', () => {
      const incoming = { id: '1', commit_timestamp: '2024-01-03T00:00:00Z' };
      const local = { id: '1', commit_timestamp: '2024-01-02T00:00:00Z' };
      expect(
        shouldApply({
          incoming,
          local,
          getKey: (r: any) => r.id,
          timestampField: 'commit_timestamp',
        })
      ).toBe(true);
    });

    it('should handle persistent timestamps for likes', () => {
      const key = 'post1:user1';
      recordAppliedTimestamp(key, '2024-01-02T00:00:00Z');

      const incoming = { post_id: 'post1', user_id: 'user1' };
      const local = { post_id: 'post1', user_id: 'user1' };

      // Older event should be dropped
      const shouldApplyOld = shouldApply({
        incoming,
        local,
        getKey: () => key,
        timestampField: 'commit_timestamp',
        eventTimestamp: '2024-01-01T00:00:00Z',
        usePersistentTimestamps: true,
      });
      expect(shouldApplyOld).toBe(false);

      // Newer event should be applied
      const shouldApplyNew = shouldApply({
        incoming,
        local,
        getKey: () => key,
        timestampField: 'commit_timestamp',
        eventTimestamp: '2024-01-03T00:00:00Z',
        usePersistentTimestamps: true,
      });
      expect(shouldApplyNew).toBe(true);
    });

    it('should allow apply when timestamps are invalid', () => {
      const incoming = { id: '1', updated_at: 'invalid' };
      const local = { id: '1', updated_at: '2024-01-02T00:00:00Z' };
      expect(shouldApply({ incoming, local })).toBe(true);
    });
  });

  describe('timestamp management', () => {
    it('should record and retrieve applied timestamps', () => {
      const key = 'post1:user1';
      const timestamp = '2024-01-01T00:00:00Z';

      recordAppliedTimestamp(key, timestamp);
      expect(getLastAppliedTimestamp(key)).toBe(timestamp);
    });

    it('should return undefined for unknown keys', () => {
      expect(getLastAppliedTimestamp('unknown')).toBeUndefined();
    });

    it('should clear all timestamps', () => {
      recordAppliedTimestamp('key1', '2024-01-01T00:00:00Z');
      recordAppliedTimestamp('key2', '2024-01-02T00:00:00Z');

      clearAppliedTimestamps();

      expect(getLastAppliedTimestamp('key1')).toBeUndefined();
      expect(getLastAppliedTimestamp('key2')).toBeUndefined();
    });
  });

  describe('like key management', () => {
    it('should create composite key for likes', () => {
      const key = createLikeKey('post1', 'user1');
      expect(key).toBe('post1:user1');
    });

    it('should extract key from PostLike', () => {
      const like: PostLike = {
        post_id: 'post1',
        user_id: 'user1',
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(getLikeKey(like)).toBe('post1:user1');
    });
  });

  describe('handleRealtimeEvent', () => {
    let cache: any;
    let outbox: any;
    let invalidateCalled: boolean;

    beforeEach(() => {
      invalidateCalled = false;
      cache = {
        data: new Map(),
        get: jest.fn((key: string) => cache.data.get(key)),
        upsert: jest.fn((row: any) => cache.data.set(row.id, row)),
        remove: jest.fn((key: string) => cache.data.delete(key)),
      };
      outbox = {
        pending: new Set(),
        has: jest.fn((clientTxId: string) => outbox.pending.has(clientTxId)),
        confirm: jest.fn((clientTxId: string) =>
          outbox.pending.delete(clientTxId)
        ),
      };
    });

    describe('INSERT events', () => {
      it('should insert new post', () => {
        const event: RealtimeEvent<Post> = {
          schema: 'public',
          table: 'posts',
          eventType: 'INSERT',
          commit_timestamp: '2024-01-01T00:00:00Z',
          new: {
            id: 'post1',
            userId: 'user1',
            user_id: 'user1',
            body: 'Test post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          old: null,
        };

        handleRealtimeEvent(event, {
          table: 'posts',
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<Post>);

        expect(cache.upsert).toHaveBeenCalledWith(event.new);
        expect(invalidateCalled).toBe(true);
      });

      it('should drop stale INSERT event', () => {
        // Setup existing post with newer timestamp
        cache.data.set('post1', {
          id: 'post1',
          updated_at: '2024-01-02T00:00:00Z',
        });

        const event: RealtimeEvent<Post> = {
          schema: 'public',
          table: 'posts',
          eventType: 'INSERT',
          commit_timestamp: '2024-01-01T00:00:00Z',
          new: {
            id: 'post1',
            userId: 'user1',
            user_id: 'user1',
            body: 'Test post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          old: null,
        };

        handleRealtimeEvent(event, {
          table: 'posts',
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<Post>);

        expect(cache.upsert).not.toHaveBeenCalled();
        expect(invalidateCalled).toBe(false);
      });
    });

    describe('UPDATE events', () => {
      it('should update existing post', () => {
        cache.data.set('post1', {
          id: 'post1',
          updated_at: '2024-01-01T00:00:00Z',
        });

        const event: RealtimeEvent<Post> = {
          schema: 'public',
          table: 'posts',
          eventType: 'UPDATE',
          commit_timestamp: '2024-01-02T00:00:00Z',
          new: {
            id: 'post1',
            userId: 'user1',
            user_id: 'user1',
            body: 'Updated post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
          old: {
            id: 'post1',
          },
        };

        handleRealtimeEvent(event, {
          table: 'posts',
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<Post>);

        expect(cache.upsert).toHaveBeenCalledWith(event.new);
        expect(invalidateCalled).toBe(true);
      });
    });

    describe('DELETE events', () => {
      it('should remove deleted post', () => {
        cache.data.set('post1', { id: 'post1' });

        const event: RealtimeEvent<Post> = {
          schema: 'public',
          table: 'posts',
          eventType: 'DELETE',
          commit_timestamp: '2024-01-02T00:00:00Z',
          new: null,
          old: {
            id: 'post1',
          },
        };

        handleRealtimeEvent(event, {
          table: 'posts',
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<Post>);

        expect(cache.remove).toHaveBeenCalledWith('post1');
        expect(invalidateCalled).toBe(true);
      });
    });

    describe('self-echo detection', () => {
      it('should confirm outbox entry and skip re-apply', () => {
        const clientTxId = 'tx-123';
        outbox.pending.add(clientTxId);

        const event: RealtimeEvent<Post> = {
          schema: 'public',
          table: 'posts',
          eventType: 'INSERT',
          commit_timestamp: '2024-01-01T00:00:00Z',
          new: {
            id: 'post1',
            userId: 'user1',
            user_id: 'user1',
            body: 'Test post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          old: null,
          client_tx_id: clientTxId,
        };

        handleRealtimeEvent(event, {
          table: 'posts',
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<Post>);

        expect(outbox.confirm).toHaveBeenCalledWith(clientTxId);
        expect(cache.upsert).not.toHaveBeenCalled();
        expect(invalidateCalled).toBe(false);
      });
    });

    describe('post_likes events', () => {
      it('should handle like INSERT', () => {
        const event: RealtimeEvent<PostLike> = {
          schema: 'public',
          table: 'post_likes',
          eventType: 'INSERT',
          commit_timestamp: '2024-01-01T00:00:00Z',
          new: {
            post_id: 'post1',
            user_id: 'user1',
            created_at: '2024-01-01T00:00:00Z',
          },
          old: null,
        };

        handleRealtimeEvent(event, {
          table: 'post_likes',
          getKey: getLikeKey,
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<PostLike>);

        expect(cache.upsert).toHaveBeenCalled();
        expect(invalidateCalled).toBe(true);
      });

      it('should handle like DELETE', () => {
        const key = 'post1:user1';
        cache.data.set(key, {
          post_id: 'post1',
          user_id: 'user1',
          created_at: '2024-01-01T00:00:00Z',
        });

        const event: RealtimeEvent<PostLike> = {
          schema: 'public',
          table: 'post_likes',
          eventType: 'DELETE',
          commit_timestamp: '2024-01-02T00:00:00Z',
          new: null,
          old: {
            post_id: 'post1',
            user_id: 'user1',
          },
        };

        handleRealtimeEvent(event, {
          table: 'post_likes',
          getKey: getLikeKey,
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<PostLike>);

        expect(cache.remove).toHaveBeenCalledWith(key);
        expect(invalidateCalled).toBe(true);
      });

      it('should drop stale like events', () => {
        const key = 'post1:user1';
        recordAppliedTimestamp(key, '2024-01-02T00:00:00Z');

        // Add existing like to cache
        cache.data.set(key, {
          post_id: 'post1',
          user_id: 'user1',
          created_at: '2024-01-01T00:00:00Z',
        });

        const event: RealtimeEvent<PostLike> = {
          schema: 'public',
          table: 'post_likes',
          eventType: 'INSERT',
          commit_timestamp: '2024-01-01T00:00:00Z',
          new: {
            post_id: 'post1',
            user_id: 'user1',
            created_at: '2024-01-01T00:00:00Z',
          },
          old: null,
        };

        handleRealtimeEvent(event, {
          table: 'post_likes',
          getKey: getLikeKey,
          cache,
          outbox,
          onInvalidate: () => {
            invalidateCalled = true;
          },
        } as EventHandlerOptions<PostLike>);

        expect(cache.upsert).not.toHaveBeenCalled();
        expect(invalidateCalled).toBe(false);
      });
    });
  });
});
