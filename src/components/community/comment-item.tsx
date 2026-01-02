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
import type { PostComment } from '@/types/community';

interface CommentItemProps {
  comment: PostComment;
  status?: 'pending' | 'failed' | 'processed';
  isHighlighted?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
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

function CommentItemComponent({
  comment,
  status = 'processed',
  isHighlighted = false,
  onRetry,
  onCancel,
  testID = 'comment-item',
}: CommentItemProps): React.ReactElement {
  const router = useRouter();
  const isPending = status === 'pending';
  const isFailed = status === 'failed';
  const shouldHighlight = isHighlighted && status === 'processed';
  const containerClasses = `border-l-2 py-3 pl-3 ${
    isFailed
      ? 'dark:bg-danger-950/20 border-danger-500 bg-danger-50 dark:border-danger-600'
      : isPending
        ? 'border-neutral-300 opacity-60 dark:border-neutral-700'
        : shouldHighlight
          ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40'
          : 'border-transparent'
  }`;

  const handleAuthorPress = React.useCallback(() => {
    router.push(`/community/${comment.user_id}`);
  }, [router, comment.user_id]);

  const formattedDate = React.useMemo(
    () => formatCommentDate(comment.created_at),
    [comment.created_at]
  );

  return (
    <View className={containerClasses} testID={testID}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate(
                'accessibility.community.view_author_profile',
                { author: comment.user_id.slice(0, 8) }
              )}
              accessibilityHint={translate(
                'accessibility.community.view_author_profile_hint'
              )}
              onPress={handleAuthorPress}
              className="min-h-11 justify-center"
            >
              <Text
                className="text-sm font-semibold text-primary-700 dark:text-primary-400"
                testID={`${testID}-author`}
              >
                @{comment.user_id.slice(0, 8)}
              </Text>
            </Pressable>
            {formattedDate && (
              <Text
                className="text-xs text-neutral-500 dark:text-neutral-400"
                testID={`${testID}-date`}
              >
                {formattedDate}
              </Text>
            )}
            {isPending && (
              <View className="flex-row items-center gap-1">
                <ActivityIndicator size="small" testID={`${testID}-loading`} />
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {translate('community.posting')}
                </Text>
              </View>
            )}
          </View>
          <Text
            className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
            testID={`${testID}-body`}
          >
            {comment.body}
          </Text>
        </View>
      </View>
      {isFailed && (
        <FailedActions onRetry={onRetry} onCancel={onCancel} testID={testID} />
      )}
    </View>
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
      prevProps.testID === nextProps.testID
    );
  }
);
