/**
 * PostCardActions - Floating action buttons for post cards
 *
 * Vertical stack of glass-style circular buttons for like, comment, share.
 * Positioned absolute right side on card.
 */

import React from 'react';
import { StyleSheet } from 'react-native';

import { LikeButton } from '@/components/community/like-button';
import { GlassSurface } from '@/components/shared/glass-surface';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { MessageCircle, PlatformIcon, Share } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});

type PostCardActionsProps = {
  postId: string;
  likeCount: number;
  userHasLiked: boolean;
  commentCount: number;
  onCommentPress: () => void;
  onSharePress: () => void;
  testID?: string;
};

type GlassActionButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  testID: string;
  children: React.ReactNode;
  label?: string; // Optional label/count below button
};

const GlassActionButton = React.memo(function GlassActionButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  children,
  label,
}: GlassActionButtonProps): React.ReactElement {
  return (
    <View className="items-center gap-1">
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        testID={testID}
      >
        <GlassSurface
          glassEffectStyle="clear"
          style={styles.button}
          fallbackClassName="bg-black/30 border border-white/15"
        >
          <View className="flex-1 items-center justify-center">{children}</View>
        </GlassSurface>
      </Pressable>
      {label && (
        <Text className="text-xs font-semibold text-white shadow-sm">
          {label}
        </Text>
      )}
    </View>
  );
});

export const PostCardActions = React.memo(function PostCardActions({
  postId,
  likeCount,
  userHasLiked,
  commentCount,
  onCommentPress,
  onSharePress,
  testID = 'post-card-actions',
}: PostCardActionsProps): React.ReactElement {
  return (
    <View className="items-center gap-4">
      {/* Like Button - custom implementation to match style */}
      <View className="items-center gap-1">
        <GlassSurface
          glassEffectStyle="clear"
          style={styles.button}
          fallbackClassName="bg-black/30 border border-white/15"
        >
          <View className="flex-1 items-center justify-center">
            <LikeButton
              postId={postId}
              likeCount={likeCount}
              userHasLiked={userHasLiked}
              compact
              testID={`${testID}-like`}
            />
          </View>
        </GlassSurface>
        <Text className="text-xs font-semibold text-white shadow-sm">
          {likeCount > 0 ? formatCount(likeCount) : 'Like'}
        </Text>
      </View>

      {/* Comment Button */}
      <GlassActionButton
        onPress={onCommentPress}
        label={commentCount > 0 ? formatCount(commentCount) : undefined}
        accessibilityLabel={String(commentCount)}
        accessibilityHint={translate(
          'accessibility.community.comment_hint' as TxKeyPath
        )}
        testID={`${testID}-comment`}
      >
        <PlatformIcon
          iosName="bubble.left"
          size={20}
          color={colors.white}
          fallback={<MessageCircle size={20} color={colors.white} />}
        />
      </GlassActionButton>

      {/* Share Button */}
      <GlassActionButton
        onPress={onSharePress}
        accessibilityLabel={translate('common.share' as TxKeyPath)}
        accessibilityHint={translate(
          'accessibility.community.share_hint' as TxKeyPath
        )}
        testID={`${testID}-share`}
      >
        <PlatformIcon
          iosName="square.and.arrow.up"
          size={20}
          color={colors.white}
          fallback={<Share size={20} color={colors.white} />}
        />
      </GlassActionButton>
    </View>
  );
});
