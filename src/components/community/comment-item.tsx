/**
 * CommentItem component
 *
 * Displays a single comment with:
 * - Pending/failed/confirmed state indicators
 * - Retry/cancel actions for failed comments
 * - Author information and timestamp
 * - Profile navigation on author tap
 * - Optimized with React.memo
 * - Enhanced accessibility
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PostComment } from '@/types/community';

interface CommentItemProps {
  comment: PostComment;
  status?: 'pending' | 'failed' | 'processed';
  isHighlighted?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  onLongPress?: () => void;
  testID?: string;
}

function formatCommentDate(createdAt?: string): string {
  if (!createdAt) return '';
  try {
    const date = new Date(createdAt);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type FailedActionsProps = {
  onRetry?: () => void;
  onCancel?: () => void;
  testID: string;
};

function FailedActions({ onRetry, onCancel, testID }: FailedActionsProps) {
  return (
    <View className="mt-2 flex-row gap-2" testID={`${testID}-failed-actions`}>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={translate('common.retry')}
        accessibilityHint={translate(
          'accessibility.community.retry_comment_hint'
        )}
        testID={`${testID}-retry`}
        className="min-h-11 flex-row items-center gap-1 rounded-md bg-primary-600 px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-white">
          {translate('common.retry')}
        </Text>
      </Pressable>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={translate('common.cancel')}
        accessibilityHint={translate(
          'accessibility.community.cancel_comment_hint'
        )}
        testID={`${testID}-cancel`}
        className="min-h-11 flex-row items-center gap-1 rounded-md bg-neutral-200 px-3 py-1.5 dark:bg-neutral-800"
      >
        <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {translate('common.cancel')}
        </Text>
      </Pressable>
    </View>
  );
}

type CommentAvatarProps = {
  displayName: string;
  onPress: () => void;
};

function getAvatarInitial(displayName: string): string {
  // Guard against null/undefined and trim whitespace
  const trimmed = displayName?.trim() || '';

  // Return fallback character if empty after trimming
  if (!trimmed) {
    return '?';
  }

  // Return first character in uppercase
  return trimmed.charAt(0).toUpperCase();
}

function CommentAvatar({ displayName, onPress }: CommentAvatarProps) {
  const avatarInitial = getAvatarInitial(displayName);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate(
        'accessibility.community.view_author_profile',
        {
          author: displayName,
        }
      )}
      accessibilityHint={translate(
        'accessibility.community.view_author_profile_hint'
      )}
    >
      <View className="size-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
        <Text className="text-sm font-bold text-primary-700 dark:text-primary-300">
          {avatarInitial}
        </Text>
      </View>
    </Pressable>
  );
}

function CommentItemComponent({
  comment,
  status = 'processed',
  isHighlighted = false,
  onRetry,
  onCancel,
  onLongPress,
  testID = 'comment-item',
}: CommentItemProps): React.ReactElement {
  const router = useRouter();
  const isPending = status === 'pending';
  const isFailed = status === 'failed';
  const shouldHighlight = isHighlighted && status === 'processed';
  const displayName = React.useMemo(
    () => comment.user_id?.slice(0, 8) || 'Unknown',
    [comment.user_id]
  );

  const containerClasses = cn(
    'mb-4 flex-row items-start',
    isFailed && 'opacity-80',
    isPending && !isFailed && 'opacity-60',
    shouldHighlight &&
      !isFailed &&
      !isPending &&
      'bg-primary-50/50 dark:bg-primary-950/20 -mx-2 px-2 py-1 rounded-lg'
  );

  const handleAuthorPress = React.useCallback(() => {
    router.push(`/community/${comment.user_id}`);
  }, [router, comment.user_id]);

  const formattedDate = React.useMemo(
    () => formatCommentDate(comment.created_at),
    [comment.created_at]
  );

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={500}
      className={containerClasses}
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={
        onLongPress
          ? translate('accessibility.community.post_options_hint')
          : undefined
      }
    >
      {/* Avatar */}
      <CommentAvatar displayName={displayName} onPress={handleAuthorPress} />

      {/* Content Column */}
      <View className="ml-3 flex-1">
        {/* Row 1: Name + Time */}
        <View className="flex-row items-center">
          <Text
            className="text-sm font-bold text-neutral-900 dark:text-neutral-50"
            testID={`${testID}-author`}
          >
            {displayName}
          </Text>
          {formattedDate && (
            <Text
              className="ml-2 text-xs text-neutral-600 dark:text-neutral-400"
              testID={`${testID}-date`}
            >
              {formattedDate}
            </Text>
          )}
          {isPending && (
            <View className="ml-2 flex-row items-center gap-1">
              <ActivityIndicator size="small" testID={`${testID}-loading`} />
              <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                {translate('community.posting')}
              </Text>
            </View>
          )}
        </View>

        {/* Row 2: Comment Text */}
        <Text
          className="mt-0.5 text-sm leading-snug text-neutral-700 dark:text-neutral-300"
          testID={`${testID}-body`}
        >
          {comment.body}
        </Text>

        {/* Failed Actions */}
        {isFailed && (
          <FailedActions
            onRetry={onRetry}
            onCancel={onCancel}
            testID={testID}
          />
        )}
      </View>
    </Pressable>
  );
}

// Memoize CommentItem to prevent unnecessary re-renders
// Only re-render if comment data, status, or callbacks change
export const CommentItem = React.memo(
  CommentItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.comment.id === nextProps.comment.id &&
      prevProps.comment.body === nextProps.comment.body &&
      prevProps.comment.created_at === nextProps.comment.created_at &&
      prevProps.status === nextProps.status &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.onRetry === nextProps.onRetry &&
      prevProps.onCancel === nextProps.onCancel &&
      prevProps.onLongPress === nextProps.onLongPress &&
      prevProps.testID === nextProps.testID
    );
  }
);
