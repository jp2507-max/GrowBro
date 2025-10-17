import { type SupabaseClient } from '@supabase/supabase-js';

import { createIdempotencyHeaders } from '@/lib/community/headers';
import { getIdempotencyService } from '@/lib/community/idempotency-service';
import { supabase } from '@/lib/supabase';

import type {
  CommunityAPI,
  ConflictResponse,
  CreateCommentData,
  CreatePostData,
  DeleteResponse,
  PaginatedResponse,
  Post,
  PostComment,
  UserProfile,
} from './types';

/**
 * Custom error classes for community API
 */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly canonicalState: ConflictResponse
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Community API client implementation
 * Provides CRUD operations for posts, comments, likes, and profiles
 * All mutating operations support idempotency
 */
export class CommunityApiClient implements CommunityAPI {
  private client: SupabaseClient;
  private idempotencyService = getIdempotencyService();
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 1000; // 1 second
  private readonly MAX_DELAY = 32000; // 32 seconds

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  // ==================== Posts ====================

  async getPost(postId: string): Promise<Post> {
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .eq('id', postId)
      .is('deleted_at', null)
      .is('hidden_at', null)
      .single();

    if (error) {
      throw new Error(`Failed to fetch post: ${error.message}`);
    }

    return this.enrichPost(data);
  }

  async getPosts(
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<Post>> {
    let query = this.client
      .from('posts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    const posts = await Promise.all(
      (data || []).map((post) => this.enrichPost(post))
    );
    const next =
      posts.length === limit ? posts[posts.length - 1].created_at : null;

    return {
      results: posts,
      count: count || 0,
      next,
      previous: null,
    };
  }

  async createPost(
    postData: CreatePostData,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<Post> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated to create posts');
    }

    const userId = session.session.user.id;

    // Validate post body length
    if (!postData.body || postData.body.length === 0) {
      throw new ValidationError('Post body cannot be empty');
    }

    if (postData.body.length > 2000) {
      throw new ValidationError('Post body cannot exceed 2000 characters');
    }

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: '/api/posts',
      payload: postData,
      operation: async () => {
        const { data, error } = await this.client
          .from('posts')
          .insert({
            user_id: userId,
            body: postData.body,
            media_uri: postData.media_uri,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create post: ${error.message}`);
        }

        return this.enrichPost(data);
      },
    });
  }

  async deletePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<DeleteResponse> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;
    const undoExpiresAt = new Date(Date.now() + 15000).toISOString(); // 15 seconds

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${postId}/delete`,
      payload: { postId },
      operation: async () => {
        const { error } = await this.client
          .from('posts')
          .update({
            deleted_at: new Date().toISOString(),
            undo_expires_at: undoExpiresAt,
          })
          .eq('id', postId)
          .eq('user_id', userId);

        if (error) {
          throw new Error(`Failed to delete post: ${error.message}`);
        }

        return { undo_expires_at: undoExpiresAt };
      },
    });
  }

  async undoDeletePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<Post> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${postId}/undo`,
      payload: { postId },
      operation: async () => {
        const { data, error } = await this.client.functions.invoke(
          'undo-delete-post',
          {
            body: { postId },
          }
        );

        if (error) {
          // Check if it's a 409 conflict (undo window expired)
          if (error.message?.includes('expired')) {
            throw new ConflictError('Undo period has expired', {
              post_id: postId,
              user_id: userId,
              exists: false,
              updated_at: new Date().toISOString(),
              message: 'Undo period has expired (15 seconds)',
            });
          }
          throw new Error(`Failed to restore post: ${error.message}`);
        }

        if (!data || !data.id) {
          throw new Error('Invalid response from undo-delete-post function');
        }

        // Fetch the full post data after restore
        const { data: post, error: fetchError } = await this.client
          .from('posts')
          .select()
          .eq('id', postId)
          .single();

        if (fetchError || !post) {
          throw new Error('Failed to fetch restored post');
        }

        return this.enrichPost(post);
      },
    });
  }

  // ==================== Likes ====================

  async likePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<void> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    await this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${postId}/like`,
      payload: { postId },
      operation: async () => {
        const { error } = await this.client.from('post_likes').upsert(
          {
            post_id: postId,
            user_id: userId,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: 'post_id,user_id',
          }
        );

        if (error) {
          throw new Error(`Failed to like post: ${error.message}`);
        }

        return undefined;
      },
    });
  }

  async unlikePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<void> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    await this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${postId}/unlike`,
      payload: { postId },
      operation: async () => {
        const { error } = await this.client
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          throw new Error(`Failed to unlike post: ${error.message}`);
        }

        return undefined;
      },
    });
  }

  // ==================== Comments ====================

  async getComments(
    postId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<PostComment>> {
    let query = this.client
      .from('post_comments')
      .select('*', { count: 'exact' })
      .eq('post_id', postId)
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    const comments = data || [];
    const next =
      comments.length === limit
        ? comments[comments.length - 1].created_at
        : null;

    return {
      results: comments,
      count: count || 0,
      next,
      previous: null,
    };
  }

  async createComment(
    commentData: CreateCommentData,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<PostComment> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    // Validate comment body length
    if (!commentData.body || commentData.body.length === 0) {
      throw new ValidationError('Comment body cannot be empty');
    }

    if (commentData.body.length > 500) {
      throw new ValidationError('Comment body cannot exceed 500 characters');
    }

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${commentData.post_id}/comments`,
      payload: commentData,
      operation: async () => {
        const { data, error } = await this.client
          .from('post_comments')
          .insert({
            post_id: commentData.post_id,
            user_id: userId,
            body: commentData.body,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create comment: ${error.message}`);
        }

        return data;
      },
    });
  }

  async deleteComment(
    commentId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<DeleteResponse> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/comments/${commentId}/delete`,
      payload: { commentId },
      operation: async () => {
        const { data, error } = await this.client.functions.invoke(
          'delete-comment',
          {
            body: { commentId },
          }
        );

        if (error) {
          throw new Error(`Failed to delete comment: ${error.message}`);
        }

        if (!data || !data.undo_expires_at) {
          throw new Error('Invalid response from delete-comment function');
        }

        return { undo_expires_at: data.undo_expires_at };
      },
    });
  }

  async undoDeleteComment(
    commentId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<PostComment> {
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    const userId = session.session.user.id;

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/comments/${commentId}/undo`,
      payload: { commentId },
      operation: async () => {
        const { data, error } = await this.client.functions.invoke(
          'undo-delete-comment',
          {
            body: { commentId },
          }
        );

        if (error) {
          // Check if it's a 409 conflict (undo window expired)
          if (error.message?.includes('expired')) {
            throw new ConflictError('Undo period has expired', {
              user_id: userId,
              exists: false,
              updated_at: new Date().toISOString(),
              message: 'Undo period has expired (15 seconds)',
            });
          }
          throw new Error(`Failed to restore comment: ${error.message}`);
        }

        if (!data || !data.id) {
          throw new Error('Invalid response from undo-delete-comment function');
        }

        // Fetch the full comment data after restore
        const { data: comment, error: fetchError } = await this.client
          .from('post_comments')
          .select()
          .eq('id', commentId)
          .single();

        if (fetchError || !comment) {
          throw new Error('Failed to fetch restored comment');
        }

        return comment;
      },
    });
  }

  // ==================== Profiles ====================

  async getUserProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data;
  }

  async getUserPosts(
    userId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<Post>> {
    let query = this.client
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch user posts: ${error.message}`);
    }

    const posts = await Promise.all(
      (data || []).map((post) => this.enrichPost(post))
    );
    const next =
      posts.length === limit ? posts[posts.length - 1].created_at : null;

    return {
      results: posts,
      count: count || 0,
      next,
      previous: null,
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Enrich post with derived fields (like_count, comment_count, user_has_liked)
   */
  private async enrichPost(post: any): Promise<Post> {
    const { data: session } = await this.client.auth.getSession();
    const userId = session?.session?.user?.id;

    // Fetch like count
    const { count: likeCount } = await this.client
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    // Fetch comment count
    const { count: commentCount } = await this.client
      .from('post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .is('deleted_at', null)
      .is('hidden_at', null);

    // Check if current user has liked
    let userHasLiked = false;
    if (userId) {
      const { data: like } = await this.client
        .from('post_likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', userId)
        .maybeSingle();

      userHasLiked = !!like;
    }

    return {
      ...post,
      like_count: likeCount || 0,
      comment_count: commentCount || 0,
      user_has_liked: userHasLiked,
    };
  }
}

// Singleton instance
let communityApiClientInstance: CommunityApiClient | null = null;

/**
 * Get the singleton community API client instance
 */
export function getCommunityApiClient(): CommunityApiClient {
  if (!communityApiClientInstance) {
    communityApiClientInstance = new CommunityApiClient();
  }
  return communityApiClientInstance;
}

/**
 * Reset the singleton instance (primarily for testing)
 */
export function resetCommunityApiClient(): void {
  communityApiClientInstance = null;
}
