/**
 * useCardInteractions - Card interaction handlers for delete and options
 */

import { useCallback, useRef } from 'react';

import type { useDeletePost } from '@/api/community';
import { showErrorMessage } from '@/lib/flash-message';
import { haptics } from '@/lib/haptics';
import { translate, type TxKeyPath } from '@/lib/i18n';

import type { PostOptionsSheetRef } from './post-options-sheet';
import type { PressEvent } from './types';

type UseCardInteractionsParams = {
  postId: number | string;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  deleteMutation: ReturnType<typeof useDeletePost>;
};

export function useCardInteractions({
  postId,
  onDelete,
  deleteMutation,
}: UseCardInteractionsParams) {
  const optionsSheetRef = useRef<PostOptionsSheetRef>(null);

  const handleOptionsPress = useCallback((e: PressEvent) => {
    e.stopPropagation();
    e.preventDefault();
    haptics.selection();
    optionsSheetRef.current?.present();
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    optionsSheetRef.current?.dismiss();
    haptics.medium();
    try {
      const result = await deleteMutation.mutateAsync({
        postId: String(postId),
      });
      onDelete?.(postId, result.undo_expires_at);
    } catch (error) {
      console.error('Delete post failed:', error);
      showErrorMessage(translate('community.delete_post_failed' as TxKeyPath));
      haptics.error();
    }
  }, [deleteMutation, postId, onDelete]);

  return {
    optionsSheetRef,
    handleOptionsPress,
    handleDeleteConfirm,
  };
}
