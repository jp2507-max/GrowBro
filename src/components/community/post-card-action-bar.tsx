/**
 * PostCardActionBar - Row 3: Like and Comment buttons
 * Premium "Deep Garden" design with better spacing and visual hierarchy
 */

import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { MessageCircle, Share } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';

import { LikeButton } from './like-button';
import type { PressEvent } from './types';

export type PostCardActionBarProps = {
  postId: string;
  likeCount: number;
  userHasLiked: boolean;
  commentCount: number;
  onCommentPress: (e: PressEvent) => void;
  onSharePress: (e: PressEvent) => void;
  iconColor: string;
  testID: string;
};

export function PostCardActionBar({
  postId,
  likeCount,
  userHasLiked,
  commentCount,
  onCommentPress,
  onSharePress,
  iconColor,
  testID,
}: PostCardActionBarProps) {
  return (
    <View className="mt-2 flex-row items-center gap-3">
      {/* Like Button */}
      <LikeButton
        postId={postId}
        likeCount={likeCount}
        userHasLiked={userHasLiked}
        testID={`${testID}-like-button`}
      />

      {/* Comment Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.community.view_comments', {
          count: commentCount,
        })}
        accessibilityHint={translate(
          'accessibility.community.view_comments_hint'
        )}
        onPress={onCommentPress}
        className="flex-row items-center gap-1.5"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MessageCircle size={20} color={iconColor} />
        {commentCount > 0 && (
          <Text
            className="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            testID={`${testID}-comment-count`}
          >
            {commentCount}
          </Text>
        )}
      </Pressable>

      {/* Share Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.community.share')}
        accessibilityHint={translate('accessibility.community.share_hint')}
        onPress={onSharePress}
        className="p-1"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={`${testID}-share-button`}
      >
        <Share size={18} color={iconColor} />
      </Pressable>
    </View>
  );
}
