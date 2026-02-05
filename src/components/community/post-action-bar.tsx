/**
 * PostActionBar - Floating glass engagement bar with stacked icons
 * Design: Semi-transparent glass effect, overlaps hero image with negative margin
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { LikeButton } from '@/components/community/like-button';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Bookmark, MessageCircle, Share } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

type PostActionBarProps = {
  postId: string;
  likeCount: number;
  commentCount: number;
  userHasLiked: boolean;
  onSharePress: () => void;
  onSavePress?: () => void;
};

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function PostActionBar({
  postId,
  likeCount,
  commentCount,
  userHasLiked,
  onSharePress,
  onSavePress,
}: PostActionBarProps): React.ReactElement {
  const { t } = useTranslation();
  const iconColor = colors.neutral[300];

  return (
    <View className="-mt-6 mb-6 flex-row items-start justify-around rounded-2xl border border-white/10 bg-charcoal-950/90 p-4">
      {/* Like Button - Stacked */}
      <View className="items-center gap-1.5">
        <LikeButton
          postId={postId}
          likeCount={likeCount}
          userHasLiked={userHasLiked}
          compact
        />
        <Text className="text-[10px] font-medium text-neutral-400">
          {formatCount(likeCount)}
        </Text>
      </View>

      {/* Comment Count - Stacked */}
      <View className="items-center gap-1.5">
        <View className="size-10 items-center justify-center">
          <MessageCircle size={24} color={iconColor} />
        </View>
        <Text className="text-[10px] font-medium text-neutral-400">
          {formatCount(commentCount)}
        </Text>
      </View>

      {/* Share - Stacked */}
      <Pressable
        onPress={onSharePress}
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.community.share' as TxKeyPath
        )}
        accessibilityHint={translate(
          'accessibility.community.share_hint' as TxKeyPath
        )}
        className="items-center gap-1.5"
      >
        <View className="size-10 items-center justify-center">
          <Share size={24} color={iconColor} />
        </View>
        <Text className="text-[10px] font-medium text-neutral-400">
          {t('community.share' as TxKeyPath)}
        </Text>
      </Pressable>

      {/* Save - Stacked */}
      <Pressable
        onPress={onSavePress}
        accessibilityRole="button"
        accessibilityLabel={translate('community.save' as TxKeyPath)}
        accessibilityHint={translate(
          'accessibility.community.save_hint' as TxKeyPath
        )}
        className="items-center gap-1.5"
      >
        <View className="size-10 items-center justify-center">
          <Bookmark size={24} color={iconColor} />
        </View>
        <Text className="text-[10px] font-medium text-neutral-400">
          {t('community.save' as TxKeyPath)}
        </Text>
      </Pressable>
    </View>
  );
}
