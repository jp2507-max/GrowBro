import { type SupabaseClient } from '@supabase/supabase-js';

import {
  CommunityApiClient,
  ConflictError,
  resetCommunityApiClient,
  ValidationError,
} from './client';
import type { CreateCommentData, CreatePostData } from './types';

// Mock dependencies
jest.mock('@/lib/supabase');
jest.mock('@/lib/community/idempotency-service');
jest.mock('@/lib/community/headers', () => ({
  createIdempotencyHeaders: jest.fn(() => ({
    'Idempotency-Key': 'test-idempotency-key',
    'X-Client-Tx-Id': 'test-client-tx-id',
  })),
  validateIdempotencyHeaders: jest.fn((key, txId) => ({ key, txId })),
}));

describe('CommunityApiClient', () => {
  let client: CommunityApiClient;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  let mockIdempotencyService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetCommunityApiClient();

    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn(),
      auth: {
        getSession: jest.fn(),
      },
    } as any;

    // Mock idempotency service
    mockIdempotencyService = {
      processWithIdempotency: jest.fn((params) => params.operation()),
    };

    // Inject mocks
    const {
      getIdempotencyService,
    } = require('@/lib/community/idempotency-service');
    (getIdempotencyService as jest.Mock).mockReturnValue(
      mockIdempotencyService
    );

    client = new CommunityApiClient(mockSupabaseClient);
  });

  describe('getPost', () => {
    it('should fetch a single post successfully', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: 'user-1',
        body: 'Test post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPost, error: null }),
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(
        (table: string) => {
          if (table === 'posts') return mockChain;
          if (table === 'post_likes') return countChain;
          return {};
        }
      );
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const post = await client.getPost('post-1');

      expect(post).toBeDefined();
      expect(post.id).toBe('post-1');
    });

    it('should throw error when post fetch fails', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Post not found' },
        }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      await expect(client.getPost('invalid-id')).rejects.toThrow(
        'Failed to fetch post'
      );
    });
  });

  describe('createPost', () => {
    it('should create a post with idempotency', async () => {
      const postData: CreatePostData = {
        body: 'New test post',
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      const mockPost = {
        id: 'post-2',
        user_id: 'user-1',
        body: 'New test post',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPost, error: null }),
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(
        (table: string) => {
          if (table === 'posts') return insertChain;
          return {};
        }
      );

      const post = await client.createPost(postData);

      expect(post).toBeDefined();
      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });

    it('should reject posts exceeding 2000 characters', async () => {
      const postData: CreatePostData = {
        body: 'a'.repeat(2001),
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      await expect(client.createPost(postData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject empty post body', async () => {
      const postData: CreatePostData = {
        body: '',
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      await expect(client.createPost(postData)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('deletePost and undoDeletePost', () => {
    it('should soft delete a post with undo window', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(updateChain);

      const result = await client.deletePost('post-1');

      expect(result).toHaveProperty('undo_expires_at');
      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });

    it('should restore a post within undo window', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      const futureTime = new Date(Date.now() + 10000).toISOString();

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { undo_expires_at: futureTime },
          error: null,
        }),
      };

      // Mock enrichPost
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );
      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(selectChain)
        .mockReturnValue(countChain);

      const post = await client.undoDeletePost('post-1');

      expect(post).toBeDefined();
      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });

    it('should reject undo after window expires', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      const pastTime = new Date(Date.now() - 1000).toISOString();

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { undo_expires_at: pastTime },
          error: null,
        }),
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(selectChain);

      // Override the operation to actually throw
      mockIdempotencyService.processWithIdempotency.mockImplementation(
        async (params: { operation: () => Promise<any> }) => {
          return params.operation();
        }
      );

      await expect(client.undoDeletePost('post-1')).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('likePost and unlikePost', () => {
    it('should like a post with idempotency', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const upsertChain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(upsertChain);

      await client.likePost('post-1');

      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });

    it('should unlike a post with idempotency', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(deleteChain);

      await client.unlikePost('post-1');

      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });
  });

  describe('createComment', () => {
    it('should create a comment with idempotency', async () => {
      const commentData: CreateCommentData = {
        post_id: 'post-1',
        body: 'Test comment',
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      const mockComment = {
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        body: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockComment, error: null }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      const comment = await client.createComment(commentData);

      expect(comment).toBeDefined();
      expect(mockIdempotencyService.processWithIdempotency).toHaveBeenCalled();
    });

    it('should reject comments exceeding 500 characters', async () => {
      const commentData: CreateCommentData = {
        post_id: 'post-1',
        body: 'a'.repeat(501),
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      await expect(client.createComment(commentData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject empty comment body', async () => {
      const commentData: CreateCommentData = {
        post_id: 'post-1',
        body: '',
      };

      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      await expect(client.createComment(commentData)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Idempotency comprehensive tests', () => {
    const mockSession = {
      data: {
        session: {
          user: { id: 'user-1' },
        },
      },
    };

    beforeEach(() => {
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );
    });

    it('should use same idempotency key for retries and return cached result', async () => {
      const idempotencyKey = 'same-key-123';
      const clientTxId = 'client-tx-456';
      const postData: CreatePostData = { body: 'Test post' };

      const mockPost = {
        id: 'post-1',
        user_id: 'user-1',
        body: 'Test post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // First call - perform operation
      mockIdempotencyService.processWithIdempotency.mockResolvedValueOnce({
        ...mockPost,
        like_count: 0,
        comment_count: 0,
        user_has_liked: false,
      });

      const result1 = await client.createPost(
        postData,
        idempotencyKey,
        clientTxId
      );

      // Second call with same key - should return cached
      mockIdempotencyService.processWithIdempotency.mockResolvedValueOnce({
        ...mockPost,
        like_count: 0,
        comment_count: 0,
        user_has_liked: false,
      });

      const result2 = await client.createPost(
        postData,
        idempotencyKey,
        clientTxId
      );

      expect(result1).toEqual(result2);
      expect(
        mockIdempotencyService.processWithIdempotency
      ).toHaveBeenCalledTimes(2);
    });

    it('should handle missing idempotency key by generating one', async () => {
      const postData: CreatePostData = { body: 'Test post' };

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-1',
            user_id: 'user-1',
            body: 'Test post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      await client.createPost(postData);

      // Verify idempotency headers were created
      const { createIdempotencyHeaders } = require('@/lib/community/headers');
      expect(createIdempotencyHeaders).toHaveBeenCalled();
    });

    it('should handle concurrent requests with same idempotency key', async () => {
      const idempotencyKey = 'concurrent-key';
      const postData: CreatePostData = { body: 'Test post' };

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-1',
            user_id: 'user-1',
            body: 'Test post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      // Simulate concurrent requests
      const promises = [
        client.createPost(postData, idempotencyKey),
        client.createPost(postData, idempotencyKey),
        client.createPost(postData, idempotencyKey),
      ];

      const results = await Promise.all(promises);

      // All should succeed with the same result
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });

  describe('Rate limiting and error handling', () => {
    it('should handle 429 rate limit errors', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue({
          status: 429,
          message: 'Rate limit exceeded',
        }),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      mockIdempotencyService.processWithIdempotency.mockImplementation(
        async (params: { operation: () => Promise<any> }) => {
          return params.operation();
        }
      );

      await expect(
        client.createPost({ body: 'Test post' })
      ).rejects.toMatchObject({
        status: 429,
      });
    });

    it('should handle network timeout errors', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      mockIdempotencyService.processWithIdempotency.mockImplementation(
        async (params: { operation: () => Promise<any> }) => {
          return params.operation();
        }
      );

      await expect(client.createPost({ body: 'Test post' })).rejects.toThrow(
        'Network timeout'
      );
    });
  });

  describe('Pagination', () => {
    it('should handle pagination with cursor correctly', async () => {
      const mockSession = {
        data: {
          session: null,
        },
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );

      const countChain = {
        select: jest.fn().mockResolvedValue({ count: 100 }),
      };

      const mockPosts = [
        {
          id: 'post-1',
          body: 'Test post 1',
          created_at: '2024-01-02T00:00:00Z',
        },
        {
          id: 'post-2',
          body: 'Test post 2',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const queryChain = {
        select: jest.fn().mockResolvedValue({
          data: mockPosts,
          error: null,
        }),
      };

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(queryChain);

      const result = await client.getPosts('2024-01-03T00:00:00Z', 20);

      expect(result.results.length).toBe(2);
      expect(result.next).toBe('2024-01-01T00:00:00Z');
      expect(result.count).toBe(100);
    });
  });
});
