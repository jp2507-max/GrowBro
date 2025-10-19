import type { Post } from '@/api/posts/types';

/**
 * Normalizes a Post object to ensure userId is the authoritative field.
 * Maps user_id to userId if user_id exists and userId doesn't.
 * This helps transition from the deprecated user_id field to userId.
 *
 * Enforces that a valid userId is present: checks userId first, then user_id.
 * If neither exists, logs an error and returns a post with sentinel userId 'invalid-user-id'.
 * Callers must reject posts with this sentinel userId.
 *
 * TODO: Flag to upstream API/data flow - ensure posts always have userId or user_id to avoid this sentinel.
 */
export function normalizePostUserId(post: Post): Post {
  if (post.userId !== undefined && post.userId !== null) {
    return post;
  }
  if (post.user_id !== undefined && post.user_id !== null) {
    return {
      ...post,
      userId: post.user_id,
    };
  }
  console.error('Post missing userId and user_id, using sentinel', {
    postId: post.id,
  });
  return {
    ...post,
    userId: 'invalid-user-id',
  };
}

/**
 * Gets the normalized user ID from a Post object, preferring userId over user_id.
 * @deprecated Use post.userId directly after ensuring posts are normalized with normalizePostUserId()
 */
export function getPostUserId(post: Post): string {
  return String(post.userId || post.user_id || '');
}
