/**
 * PostActionBar - Like, comment count, and share buttons
 */
import * as React from 'react';

import { LikeButton } from '@/components/community/like-button';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { MessageCircle, Share } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

type PostActionBarProps = {
  postId: string;
  likeCount: number;
  commentCount: number;
  userHasLiked: boolean;
  isDark: boolean;
  onSharePress: () => void;
};

export function PostActionBar({
  postId,
  likeCount,
  commentCount,
  userHasLiked,
  isDark,
  onSharePress,
}: PostActionBarProps): React.ReactElement {
  const iconColor = isDark ? colors.neutral[400] : colors.neutral[600];

  return (
    <View className="mb-4 flex-row items-center gap-6">
      {/* Like Button */}
      <LikeButton
        postId={postId}
        likeCount={likeCount}
        userHasLiked={userHasLiked}
      />

      {/* Comment Count */}
      <View className="flex-row items-center gap-1.5">
        <MessageCircle width={26} height={26} color={iconColor} />
        {commentCount > 0 && (
          <Text className="text-base font-semibold text-neutral-600 dark:text-neutral-400">
            {commentCount}
          </Text>
        )}
      </View>

      {/* Share */}
      <Pressable
        onPress={onSharePress}
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.community.share' as TxKeyPath
        )}
        accessibilityHint={translate(
          'accessibility.community.share_hint' as TxKeyPath
        )}
        className="flex-row items-center gap-1.5"
      >
        <Share width={26} height={26} color={iconColor} />
      </Pressable>
    </View>
  );
}
