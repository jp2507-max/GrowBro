/**
 * PostDetailCommentSection - Comments header and list
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
      {/* Comments Header */}
      <View className="mb-4 flex-row items-center gap-2">
        <View className="size-1 rounded-full bg-primary-500" />
        <Text className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {translate('community.comments' as TxKeyPath)}
        </Text>
      </View>
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
