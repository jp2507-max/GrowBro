/**
 * CommentList component
 *
 * Displays list of comments with:
 * - Pending/failed/confirmed state indicators
 * - Empty state when no comments
 * - Loading state
 * - Retry/cancel functionality for failed comments
 */

import React from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { ActivityIndicator, Text, View } from '@/components/ui';
import type { PostComment } from '@/types/community';

import { ModeratedCommentItem } from './moderated-comment-item';

interface CommentListProps {
  comments: PostComment[];
  isLoading?: boolean;
  commentStatuses?: Record<string, 'pending' | 'failed' | 'processed'>;
  highlightedCommentId?: string;
  onHighlightedCommentLayout?: (y: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRetryComment?: (commentId: string) => void;
  onCancelComment?: (commentId: string) => void;
  testID?: string;
}

export function CommentList({
  comments,
  isLoading = false,
  commentStatuses = {},
  highlightedCommentId,
  onHighlightedCommentLayout,
  onLayout,
  onRetryComment,
  onCancelComment,
  testID = 'comment-list',
}: CommentListProps): React.ReactElement {
  if (isLoading) {
    return (
      <View className="items-center py-8" testID={`${testID}-loading`}>
        <ActivityIndicator />
        <Text
          className="mt-2 text-sm text-neutral-500 dark:text-neutral-400"
          tx="community.comment_list.loading"
        />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View className="items-center py-8" testID={`${testID}-empty`}>
        <Text
          className="text-sm text-neutral-500 dark:text-neutral-400"
          tx="community.comment_list.empty"
        />
      </View>
    );
  }

  return (
    <View testID={testID} onLayout={onLayout}>
      {comments.map((comment) => {
        // Determine status: use provided status map, fallback to temp- check, default to processed
        const status =
          commentStatuses[comment.id] ||
          (comment.id.startsWith('temp-') ? 'pending' : 'processed');

        const isFailed = status === 'failed';
        const isHighlighted = comment.id === highlightedCommentId;

        return (
          <ModeratedCommentItem
            key={comment.id}
            comment={comment}
            status={status}
            isHighlighted={isHighlighted}
            onLayout={
              isHighlighted && onHighlightedCommentLayout
                ? (event) =>
                    onHighlightedCommentLayout(event.nativeEvent.layout.y)
                : undefined
            }
            onRetry={
              isFailed && onRetryComment
                ? () => onRetryComment(comment.id)
                : undefined
            }
            onCancel={
              isFailed && onCancelComment
                ? () => onCancelComment(comment.id)
                : undefined
            }
            testID={`comment-item-${comment.id}`}
          />
        );
      })}
    </View>
  );
}
