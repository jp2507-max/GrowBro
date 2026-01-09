/**
 * LikeButton component
 *
 * Displays like button with optimistic updates:
 * - Immediate visual feedback on tap
 * - Shows pending state during mutation
 * - Displays current like count
 * - Handles errors with rollback
 * - Optimized with React.memo to prevent unnecessary re-renders
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useLikePost, useUnlikePost } from '@/api/community';
import { GlassSurface } from '@/components/shared/glass-surface';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';

interface LikeButtonProps {
  postId: string;
  likeCount: number;
  userHasLiked: boolean;
  testID?: string;
  /** When true, shows only heart icon without count (for BlurView overlays) */
  compact?: boolean;
  /** Variant style: 'default' for inline, 'overlay' for Kitchen Stories bottom-right style */
  variant?: 'default' | 'overlay';
}

interface LikeButtonContentProps {
  isPending: boolean;
  userHasLiked: boolean;
  likeCount: number;
  testID: string;
}

function CompactContent({
  isPending,
  userHasLiked,
  testID,
}: Omit<LikeButtonContentProps, 'likeCount'>) {
  if (isPending) {
    return (
      <ActivityIndicator
        size="small"
        color={colors.white}
        testID={`${testID}-loading`}
      />
    );
  }
  return (
    <Text className="text-xl text-black dark:text-white">
      {userHasLiked ? '♥' : '♡'}
    </Text>
  );
}

function OverlayContent({
  isPending,
  userHasLiked,
  likeCount,
  testID,
}: LikeButtonContentProps) {
  return (
    <>
      {isPending ? (
        <ActivityIndicator
          size="small"
          color={colors.terracotta[500]}
          testID={`${testID}-loading`}
        />
      ) : (
        <Text
          className={`text-sm ${
            userHasLiked
              ? 'text-terracotta-500'
              : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {userHasLiked ? '♥' : '♡'}
        </Text>
      )}
      {likeCount > 0 && (
        <Text
          className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
          testID={`${testID}-count`}
        >
          {likeCount}
        </Text>
      )}
    </>
  );
}

function DefaultContent({
  isPending,
  userHasLiked,
  likeCount,
  testID,
}: LikeButtonContentProps) {
  return (
    <View
      className={`flex-row items-center gap-2 rounded-full px-3 py-1.5 ${
        userHasLiked
          ? 'bg-terracotta-500 dark:bg-terracotta-600'
          : 'bg-neutral-200 dark:bg-neutral-800'
      } ${isPending ? 'opacity-60' : 'opacity-100'}`}
    >
      {isPending ? (
        <ActivityIndicator
          size="small"
          color={userHasLiked ? colors.white : undefined}
          testID={`${testID}-loading`}
        />
      ) : (
        <Text
          className={`text-sm font-semibold ${
            userHasLiked
              ? 'text-white dark:text-white'
              : 'text-neutral-700 dark:text-neutral-300'
          }`}
        >
          {userHasLiked ? '♥' : '♡'}
        </Text>
      )}
      <Text
        className={`text-sm font-semibold ${
          userHasLiked
            ? 'text-white dark:text-white'
            : 'text-neutral-700 dark:text-neutral-300'
        }`}
        testID={`${testID}-count`}
      >
        {likeCount}
      </Text>
    </View>
  );
}

function LikeButtonComponent({
  postId,
  likeCount,
  userHasLiked,
  testID = 'like-button',
  compact = false,
  variant = 'default',
}: LikeButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();

  const isPending = likeMutation.isPending || unlikeMutation.isPending;

  const handlePress = React.useCallback(() => {
    if (isPending) return; // Prevent multiple taps during pending mutation

    if (userHasLiked) {
      unlikeMutation.mutate({ postId });
    } else {
      likeMutation.mutate({ postId });
    }
  }, [postId, userHasLiked, isPending, likeMutation, unlikeMutation]);

  const buttonLabel = React.useMemo(() => {
    return userHasLiked
      ? t('community.like_button_unlike')
      : t('community.like_button_like');
  }, [userHasLiked, t]);

  const accessibilityLabel = React.useMemo(() => {
    const countLabel = t('community.like_count', { count: likeCount });
    return `${buttonLabel}, ${countLabel}`;
  }, [buttonLabel, likeCount, t]);

  // Compact mode: just heart icon for BlurView overlays
  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('accessibility.community.like_button_hint')}
        testID={testID}
      >
        <CompactContent
          isPending={isPending}
          userHasLiked={userHasLiked}
          testID={testID}
        />
      </Pressable>
    );
  }

  // Overlay mode: Kitchen Stories style - glass pill with heart + count
  if (variant === 'overlay') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('accessibility.community.like_button_hint')}
        testID={testID}
        className={isPending ? 'opacity-60' : 'opacity-100'}
      >
        <GlassSurface
          glassEffectStyle="clear"
          style={styles.roundedPill}
          fallbackClassName="bg-white dark:bg-charcoal-800"
        >
          <View className="flex-row items-center gap-1 px-2 py-1">
            <OverlayContent
              isPending={isPending}
              userHasLiked={userHasLiked}
              likeCount={likeCount}
              testID={testID}
            />
          </View>
        </GlassSurface>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t('accessibility.community.like_button_hint')}
      testID={testID}
      className="flex-row items-center gap-2"
    >
      <DefaultContent
        isPending={isPending}
        userHasLiked={userHasLiked}
        likeCount={likeCount}
        testID={testID}
      />
    </Pressable>
  );
}

// Memoize LikeButton to prevent re-renders when parent updates
// Only re-render if props affect the visual state (postId, counts, status, variant, compact)
export const LikeButton = React.memo(
  LikeButtonComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.postId === nextProps.postId &&
      prevProps.likeCount === nextProps.likeCount &&
      prevProps.userHasLiked === nextProps.userHasLiked &&
      prevProps.testID === nextProps.testID &&
      prevProps.variant === nextProps.variant &&
      prevProps.compact === nextProps.compact
    );
  }
);

const styles = StyleSheet.create({
  roundedPill: {
    borderRadius: 999,
  },
});
