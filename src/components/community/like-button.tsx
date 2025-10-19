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
import { ActivityIndicator } from 'react-native';

import { useLikePost, useUnlikePost } from '@/api/community';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';

interface LikeButtonProps {
  postId: string;
  likeCount: number;
  userHasLiked: boolean;
  testID?: string;
}

function LikeButtonComponent({
  postId,
  likeCount,
  userHasLiked,
  testID = 'like-button',
}: LikeButtonProps): React.ReactElement {
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
    return userHasLiked ? 'Unlike' : 'Like';
  }, [userHasLiked]);

  const accessibilityLabel = React.useMemo(() => {
    const countLabel = likeCount === 1 ? 'like' : 'likes';
    return `${buttonLabel}, ${likeCount} ${countLabel}`;
  }, [buttonLabel, likeCount]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double-tap to toggle like status for this post."
      testID={testID}
      className="flex-row items-center gap-2"
    >
      <View
        className={`flex-row items-center gap-2 rounded-full px-3 py-1.5 ${
          userHasLiked
            ? 'bg-primary-600 dark:bg-primary-500'
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
    </Pressable>
  );
}

// Memoize LikeButton to prevent re-renders when parent updates
// Only re-render if postId, likeCount, userHasLiked, or testID changes
export const LikeButton = React.memo(
  LikeButtonComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.postId === nextProps.postId &&
      prevProps.likeCount === nextProps.likeCount &&
      prevProps.userHasLiked === nextProps.userHasLiked &&
      prevProps.testID === nextProps.testID
    );
  }
);
