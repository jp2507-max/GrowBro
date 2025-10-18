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
    const query = this.client
      .from('posts')
      .select('*')
      .eq('id', postId)
      .is('deleted_at', null)
      .is('hidden_at', null);

    const posts = await this.getPostsWithCounts(query, true);

    if (posts.length === 0) {
      throw new Error('Post not found');
    }

    return posts[0];
  }

  async getPosts(
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<Post>> {
    // Get the exact count separately since subqueries don't support count
    const { count } = await this.client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .is('hidden_at', null);

    let query = this.client
      .from('posts')
      .select('*')
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const posts = await this.getPostsWithCounts(query);
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

        // For newly created posts, counts are 0 and user hasn't liked their own post
        return {
          ...data,
          userId: data.user_id,
          like_count: 0,
          comment_count: 0,
          user_has_liked: false,
        };
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

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId,
      endpoint: `/api/posts/${postId}/delete`,
      payload: { postId },
      operation: async () => {
        const { data, error } = await this.client.functions.invoke(
          'delete-post',
          {
            body: { postId },
            headers,
          }
        );

        if (error) {
          throw new Error(`Failed to delete post: ${error.message}`);
        }

        if (!data || !data.undo_expires_at) {
          throw new Error('Invalid response from delete-post function');
        }

        return { undo_expires_at: data.undo_expires_at };
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
            headers,
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
        const query = this.client.from('posts').select('*').eq('id', postId);

        const posts = await this.getPostsWithCounts(query, true);

        if (posts.length === 0) {
          throw new Error('Failed to fetch restored post');
        }

        return posts[0];
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
            headers,
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
            headers,
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

  // ==================== Moderation ====================

  async moderateContent(options: {
    contentType: 'post' | 'comment';
    contentId: string;
    action: 'hide' | 'unhide';
    reason?: string;
    idempotencyKey?: string;
    clientTxId?: string;
  }): Promise<void> {
    const {
      contentType,
      contentId,
      action,
      reason,
      idempotencyKey,
      clientTxId,
    } = options;
    const headers = createIdempotencyHeaders(idempotencyKey, clientTxId);
    const { data: session } = await this.client.auth.getSession();

    if (!session?.session?.user) {
      throw new ValidationError('User must be authenticated');
    }

    return this.idempotencyService.processWithIdempotency({
      key: headers['Idempotency-Key'],
      clientTxId: headers['X-Client-Tx-Id'],
      userId: session.session.user.id,
      endpoint: '/api/moderate',
      payload: { contentType, contentId, action, reason },
      operation: async () => {
        const { data, error } = await this.client.rpc('moderate_content', {
          p_content_type: contentType,
          p_content_id: contentId,
          p_action: action,
          p_reason: reason,
          p_idempotency_key: headers['Idempotency-Key'],
        });

        if (error) {
          throw new Error(
            `Failed to ${action} ${contentType}: ${error.message}`
          );
        }

        // Check if RPC returned success: false (authorization/validation failures)
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          data.success === false
        ) {
          const errorMessage = (data as any).error || 'Moderation failed';
          throw new Error(
            `Failed to ${action} ${contentType}: ${errorMessage}`
          );
        }
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
    // Get the exact count separately since subqueries don't support count
    const { count } = await this.client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('hidden_at', null);

    let query = this.client
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const posts = await this.getPostsWithCounts(query);
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
   * Get posts with like/comment counts and user like status in a single optimized query
   */
  private async getPostsWithCounts(
    query: any,
    includeUserLikes: boolean = true
  ): Promise<Post[]> {
    const { data: session } = await this.client.auth.getSession();
    const userId = session?.session?.user?.id;

    // Build the select query using denormalized count fields maintained by triggers
    const selectQuery = query.select(`
      *,
      like_count,
      comment_count
    `);

    const { data: posts, error } = await selectQuery;

    if (error) {
      throw new Error(`Failed to fetch posts with counts: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      return [];
    }

    // If user is authenticated and we need user like status, fetch all likes for these posts in one query
    let userLikesMap = new Map<string, boolean>();
    if (userId && includeUserLikes) {
      const postIds = posts.map((post: any) => post.id);
      const { data: likes } = await this.client
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (likes) {
        likes.forEach((like: any) => {
          userLikesMap.set(like.post_id, true);
        });
      }
    }

    // Map the results to include user_has_liked
    return posts.map((post: any) => ({
      ...post,
      userId: post.user_id,
      like_count: post.like_count ?? 0,
      comment_count: post.comment_count ?? 0,
      user_has_liked: userLikesMap.get(post.id) ?? false,
    }));
  }

  /**
   * Enrich post with derived fields (like_count, comment_count, user_has_liked)
   * @deprecated Use getPostsWithCounts for bulk operations to avoid N+1 queries
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
