/**
 * PostDetailCommentSection - Comments header with Top Rated pill and list
 * Design: Premium glass-effect styling with sort selector
 */

import * as React from 'react';

import { CommentList } from '@/components/community/comment-list';
import { Text, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib/i18n';
import type { PostComment } from '@/types/community';

type PostDetailCommentSectionProps = {
  comments: PostComment[];
  isLoading: boolean;
  highlightedCommentId?: string;
  onCommentListLayout?: (y: number) => void;
  onHighlightedCommentLayout?: (y: number) => void;
};

export function PostDetailCommentSection({
  comments,
  isLoading,
  highlightedCommentId,
  onCommentListLayout,
  onHighlightedCommentLayout,
}: PostDetailCommentSectionProps): React.ReactElement {
  return (
    <>
      {/* Comments Header with Count Badge and Top Rated Pill */}
      <View className="mb-5 flex-row items-center justify-between">
        {/* Left side: Title + Count */}
        <View className="flex-row items-center gap-3">
          <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
            {translate('community.comments' as TxKeyPath)}
          </Text>
          {comments.length > 0 && (
            <View className="rounded-full bg-lime-500/20 px-2.5 py-0.5">
              <Text className="text-xs font-semibold text-lime-600 dark:text-lime-400">
                {comments.length}
              </Text>
            </View>
          )}
        </View>

        {/* Right side: Top Rated Pill (static for now) */}
        <View className="flex-row items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          <Text className="text-xs font-medium text-neutral-400">
            {translate('community.top_rated' as TxKeyPath)}
          </Text>
        </View>
      </View>

      {/* Comment List */}
      <CommentList
        comments={comments}
        isLoading={isLoading}
        highlightedCommentId={highlightedCommentId}
        onHighlightedCommentLayout={onHighlightedCommentLayout}
        onLayout={
          onCommentListLayout
            ? (event) => onCommentListLayout(event.nativeEvent.layout.y)
            : undefined
        }
      />
    </>
  );
}
