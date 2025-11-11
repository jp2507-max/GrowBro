import { type SupabaseClient } from '@supabase/supabase-js';

import type { PaginateQuery } from '@/api/types';
import { createIdempotencyHeaders } from '@/lib/community/headers';
import { getIdempotencyService } from '@/lib/community/idempotency-service';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { supabase } from '@/lib/supabase';

import type {
  CommunityAPI,
  ConflictResponse,
  CreateCommentData,
  CreatePostData,
  DeleteResponse,
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
 * Utility function for delays in retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  ): Promise<PaginateQuery<Post>> {
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
            client_tx_id: headers['X-Client-Tx-Id'],
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

  /**
   * Fetch a post with retry logic for handling replication lag after restore
   */
  private async fetchPostWithRetry(
    postId: string,
    maxRetries: number = 3,
    retryDelay: number = 500
  ): Promise<Post> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const query = this.client
          .from('posts')
          .select('*')
          .eq('id', postId)
          .is('deleted_at', null)
          .is('hidden_at', null);
        const posts = await this.getPostsWithCounts(query, true);

        if (posts.length > 0) {
          return posts[0];
        }

        if (attempt < maxRetries) {
          await sleep(retryDelay);
        }
      } catch (error) {
        if (attempt < maxRetries) {
          await sleep(retryDelay);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Post not found after retries');
  }

  /**
   * Run diagnostic queries for a post to determine visibility issues
   */
  private async runPostDiagnostic(postId: string): Promise<{
    diagnosticPost: any;
    diagnosticError: any;
  }> {
    const { data: diagnosticPost, error: diagnosticError } = await this.client
      .from('posts')
      .select('id, deleted_at, created_at, updated_at')
      .eq('id', postId)
      .single();

    return { diagnosticPost, diagnosticError };
  }

  /**
   * Determine specific error message based on diagnostic results
   */
  private determinePostError(
    diagnosticPost: any,
    _lastError: Error | null
  ): Error {
    if (diagnosticPost && diagnosticPost.deleted_at) {
      return new Error(
        'Post restored but not yet visible - possible replication delay'
      );
    } else if (diagnosticPost) {
      return new Error(
        'Post exists but not visible - possible RLS policy blocking access'
      );
    } else {
      return new Error(
        'Post not found - undo may have failed or post was permanently deleted'
      );
    }
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
          const status = error?.context?.status;
          if (status === 409) {
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

        try {
          return await this.fetchPostWithRetry(postId);
        } catch (fetchError) {
          // Run diagnostics and throw appropriate error
          const { diagnosticPost, diagnosticError } =
            await this.runPostDiagnostic(postId);

          const diagnosticInfo = {
            postId,
            userId,
            attemptCount: 3,
            lastError:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError),
            diagnosticQueryResult: diagnosticPost,
            diagnosticError: diagnosticError?.message,
            queryTimestamp: new Date().toISOString(),
          };

          captureCategorizedErrorSync(
            fetchError instanceof Error
              ? fetchError
              : new Error('Post fetch failed after retries'),
            {
              category: 'replication_lag',
              operation: 'undo_delete_post',
              ...diagnosticInfo,
            }
          );

          throw this.determinePostError(
            diagnosticPost,
            fetchError instanceof Error ? fetchError : null
          );
        }
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
            client_tx_id: headers['X-Client-Tx-Id'],
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
  ): Promise<PaginateQuery<PostComment>> {
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
      endpoint: `/api/posts/${commentData.postId}/comments`,
      payload: commentData,
      operation: async () => {
        const { data, error } = await this.client
          .from('post_comments')
          .insert({
            post_id: commentData.postId,
            user_id: userId,
            body: commentData.body,
            client_tx_id: headers['X-Client-Tx-Id'],
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

  /**
   * Fetch a comment with retry logic for handling replication lag after restore
   */
  private async fetchCommentWithRetry(
    commentId: string,
    maxRetries: number = 3,
    retryDelay: number = 500
  ): Promise<PostComment> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data: fetchedComment, error: fetchError } = await this.client
          .from('post_comments')
          .select()
          .eq('id', commentId)
          .is('deleted_at', null)
          .is('hidden_at', null)
          .single();

        if (!fetchError && fetchedComment) {
          return fetchedComment;
        }

        if (attempt < maxRetries) {
          await sleep(retryDelay);
        }
      } catch (error) {
        if (attempt < maxRetries) {
          await sleep(retryDelay);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Comment not found after retries');
  }

  /**
   * Run diagnostic queries for a comment to determine visibility issues
   */
  private async runCommentDiagnostic(commentId: string): Promise<{
    diagnosticComment: any;
    diagnosticError: any;
  }> {
    const { data: diagnosticComment, error: diagnosticError } =
      await this.client
        .from('post_comments')
        .select('id, deleted_at, created_at, updated_at')
        .eq('id', commentId)
        .single();

    return { diagnosticComment, diagnosticError };
  }

  /**
   * Determine specific error message based on diagnostic results for comments
   */
  private determineCommentError(
    diagnosticComment: any,
    _lastError: Error | null
  ): Error {
    if (diagnosticComment && diagnosticComment.deleted_at) {
      return new Error(
        'Comment restored but not yet visible - possible replication delay'
      );
    } else if (diagnosticComment) {
      return new Error(
        'Comment exists but not visible - possible RLS policy blocking access'
      );
    } else {
      return new Error(
        'Comment not found - undo may have failed or comment was permanently deleted'
      );
    }
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
          const status = error?.context?.status;
          if (status === 409) {
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

        try {
          return await this.fetchCommentWithRetry(commentId);
        } catch (fetchError) {
          // Run diagnostics and throw appropriate error
          const { diagnosticComment, diagnosticError } =
            await this.runCommentDiagnostic(commentId);

          const diagnosticInfo = {
            commentId,
            userId,
            attemptCount: 3,
            lastError:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError),
            diagnosticQueryResult: diagnosticComment,
            diagnosticError: diagnosticError?.message,
            queryTimestamp: new Date().toISOString(),
          };

          captureCategorizedErrorSync(
            fetchError instanceof Error
              ? fetchError
              : new Error('Comment fetch failed after retries'),
            {
              category: 'replication_lag',
              operation: 'undo_delete_comment',
              ...diagnosticInfo,
            }
          );

          throw this.determineCommentError(
            diagnosticComment,
            fetchError instanceof Error ? fetchError : null
          );
        }
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
  ): Promise<PaginateQuery<Post>> {
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

    // Collect all media paths that need signed URLs
    const mediaPaths: string[] = [];
    posts.forEach((post: any) => {
      if (post.media_uri) mediaPaths.push(post.media_uri);
      if (post.media_resized_uri) mediaPaths.push(post.media_resized_uri);
      if (post.media_thumbnail_uri) mediaPaths.push(post.media_thumbnail_uri);
    });

    // Generate signed URLs for all media in one batch request
    const signedUrlMap = await this.generateSignedUrls(mediaPaths);

    // Helper to strip bucket prefix from path for map lookup
    // Edge function returns keys without the 'community-posts/' prefix
    const BUCKET_PREFIX = 'community-posts/';
    const getSignedUrl = (path: string | undefined): string | undefined => {
      if (!path) return undefined;
      const lookupKey = path.startsWith(BUCKET_PREFIX)
        ? path.slice(BUCKET_PREFIX.length)
        : path;
      return signedUrlMap[lookupKey];
    };

    // Transform storage paths to signed URLs
    const postsWithSignedUrls = posts.map((post: any) => ({
      ...post,
      media_uri: getSignedUrl(post.media_uri),
      media_resized_uri: getSignedUrl(post.media_resized_uri),
      media_thumbnail_uri: getSignedUrl(post.media_thumbnail_uri),
    }));

    // If user is authenticated and we need user like status, fetch all likes for these posts in one query
    let userLikesMap = new Map<string, boolean>();
    if (userId && includeUserLikes) {
      const postIds = postsWithSignedUrls.map((post: any) => post.id);
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
    return postsWithSignedUrls.map((post: any) => ({
      ...post,
      userId: post.user_id,
      like_count: post.like_count ?? 0,
      comment_count: post.comment_count ?? 0,
      user_has_liked: userLikesMap.get(post.id) ?? false,
    }));
  }

  /**
   * Generate signed URLs from storage paths via Edge Function
   * Uses service-role key on backend to bypass RLS restrictions while maintaining security
   * @param storagePaths - Array of storage paths to generate signed URLs for
   * @returns Map of path -> signed URL
   */
  private async generateSignedUrls(
    storagePaths: string[]
  ): Promise<Record<string, string>> {
    if (storagePaths.length === 0) {
      return {};
    }

    try {
      const { data: session } = await this.client.auth.getSession();
      if (!session?.session?.access_token) {
        console.error(
          '[CommunityApiClient] No active session for signed URL generation'
        );
        // Return identity map as fallback
        return Object.fromEntries(storagePaths.map((path) => [path, path]));
      }

      const response = await this.client.functions.invoke('get-media-urls', {
        body: { paths: storagePaths },
      });

      if (response.error) {
        console.error(
          '[CommunityApiClient] Failed to generate signed URLs:',
          response.error
        );
        // Return identity map as fallback
        return Object.fromEntries(storagePaths.map((path) => [path, path]));
      }

      return response.data?.urls ?? {};
    } catch (error) {
      console.error(
        '[CommunityApiClient] Exception generating signed URLs:',
        error
      );
      // Return identity map as fallback
      return Object.fromEntries(storagePaths.map((path) => [path, path]));
    }
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
