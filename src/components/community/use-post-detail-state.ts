/**
 * usePostDetailState - Comment state, highlight logic, and submission handling
 */

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { TextInput } from 'react-native';

import { useComments, useCreateComment } from '@/api/community';

type UsePostDetailStateParams = {
  postId: string;
  commentId?: string;
};

export function usePostDetailState({
  postId,
  commentId,
}: UsePostDetailStateParams) {
  // Comment form state
  const [commentBody, setCommentBody] = React.useState('');
  const commentInputRef = React.useRef<TextInput>(null);
  const queryClient = useQueryClient();
  const createCommentMutation = useCreateComment();

  // Highlighted comment state
  const [highlightedCommentId, setHighlightedCommentId] = React.useState<
    string | undefined
  >(undefined);

  // Comments query
  const { data: commentsData, isLoading: isLoadingComments } = useComments({
    postId,
    limit: 20,
  });

  // Handle comment submission
  const handleCommentSubmit = React.useCallback(async () => {
    if (!commentBody.trim() || createCommentMutation.isPending) return;
    try {
      await createCommentMutation.mutateAsync({
        postId,
        body: commentBody.trim(),
      });
      setCommentBody('');
      commentInputRef.current?.blur();
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    } catch {
      // Error is handled by mutation's onError
    }
  }, [createCommentMutation, postId, commentBody, queryClient]);

  // Highlight comment from deep link; scrolling is handled by PostDetailContent
  React.useEffect(() => {
    if (!commentId || isLoadingComments) return;
    setHighlightedCommentId(commentId);
    const timeout = setTimeout(() => {
      setHighlightedCommentId(undefined);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [commentId, isLoadingComments]);

  return {
    // Form state
    commentBody,
    setCommentBody,
    commentInputRef,
    handleCommentSubmit,
    isSubmitting: createCommentMutation.isPending,

    // Comments data
    comments: commentsData?.results ?? [],
    isLoadingComments,
    highlightedCommentId,
  };
}
