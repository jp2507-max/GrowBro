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
    <View className="mt-3 flex-row items-center gap-2">
      {/* Like Button */}
      <LikeButton
        postId={postId}
        likeCount={likeCount}
        userHasLiked={userHasLiked}
        testID={`${testID}-like-button`}
      />

      {/* Comment Button - pill style */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.community.view_comments', {
          count: commentCount,
        })}
        accessibilityHint={translate(
          'accessibility.community.view_comments_hint'
        )}
        onPress={onCommentPress}
        className="dark:bg-white/8 min-h-[36px] min-w-[36px] flex-row items-center justify-center gap-1.5 rounded-full bg-neutral-100 px-3"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <MessageCircle size={18} color={iconColor} />
        {commentCount > 0 && (
          <Text
            className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300"
            testID={`${testID}-comment-count`}
          >
            {commentCount}
          </Text>
        )}
      </Pressable>

      {/* Share Button - pill style */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.community.share')}
        accessibilityHint={translate('accessibility.community.share_hint')}
        onPress={(e) => {
          e.stopPropagation();
          onSharePress(e);
        }}
        className="dark:bg-white/8 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-neutral-100 px-3"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        testID={`${testID}-share-button`}
      >
        <Share size={16} color={iconColor} />
      </Pressable>
    </View>
  );
}
