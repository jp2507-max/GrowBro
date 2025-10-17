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

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      // Mock enrichPost queries
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      };
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(countChain);

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

      (mockSupabaseClient.from as jest.Mock).mockReturnValue(insertChain);

      // Mock enrichPost
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      };
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(countChain);

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

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-1',
            user_id: 'user-1',
            body: 'Restored post',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue(
        mockSession
      );
      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      // Mock enrichPost
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      };
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(countChain);

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
  });
});
