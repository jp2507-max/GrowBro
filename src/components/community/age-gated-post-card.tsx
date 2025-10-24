/**
 * Age-Gated Post Card Component
 *
 * Wrapper for PostCard that handles age-restricted content display
 * Implements DSA Art. 28 age-gating enforcement
 *
 * Requirements:
 * - 8.2: Restrict visibility to verified 18+ users
 * - 8.5: Implement safer defaults for minors
 * - 8.7: Filter age-restricted content in feeds
 */

import React from 'react';

import type { Post as ApiPost } from '@/api/posts';

import { AgeRestrictedContentPlaceholder } from './age-restricted-content-placeholder';
import { PostCard } from './post-card';

interface AgeGatedPostCardProps {
  post: ApiPost;
  isAgeVerified: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  onVerifyPress?: () => void;
  testID?: string;
}

export function AgeGatedPostCard({
  post,
  isAgeVerified,
  onDelete,
  onVerifyPress,
  testID = 'age-gated-post-card',
}: AgeGatedPostCardProps): React.ReactElement {
  // Check if post is age-restricted
  const isAgeRestricted = post.is_age_restricted ?? false;

  // If not age-restricted or user is verified, show normal post
  if (!isAgeRestricted || isAgeVerified) {
    return <PostCard post={post} onDelete={onDelete} testID={testID} />;
  }

  // Show placeholder for age-restricted content
  return (
    <AgeRestrictedContentPlaceholder
      contentType="post"
      onVerifyPress={onVerifyPress}
      showVerifyButton
    />
  );
}
