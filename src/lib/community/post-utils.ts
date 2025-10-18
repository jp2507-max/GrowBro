import type { Post } from '@/api/posts/types';

/**
 * Normalizes a Post object to ensure userId is the authoritative field.
 * Maps user_id to userId if user_id exists and userId doesn't.
 * This helps transition from the deprecated user_id field to userId.
 */
export function normalizePostUserId(post: Post): Post {
  if (post.user_id && !post.userId) {
    return {
      ...post,
      userId: post.user_id,
    };
  }
  return post;
}

/**
 * Gets the normalized user ID from a Post object, preferring userId over user_id.
 * @deprecated Use post.userId directly after ensuring posts are normalized with normalizePostUserId()
 */
export function getPostUserId(post: Post): string {
  return String(post.userId || post.user_id || '');
}
