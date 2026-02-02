/**
 * useCardInteractions - Interactions for post card options/delete
 */

import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import React from 'react';

import type { useDeletePost } from '@/api/community';

type UseCardInteractionsOptions = {
  postId: number | string;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  deleteMutation: ReturnType<typeof useDeletePost>;
};

type UseCardInteractionsReturn = {
  optionsSheetRef: React.RefObject<BottomSheetModal | null>;
  handleDeleteConfirm: () => Promise<void>;
};

export function useCardInteractions({
  postId,
  onDelete,
  deleteMutation,
}: UseCardInteractionsOptions): UseCardInteractionsReturn {
  const optionsSheetRef = React.useRef<BottomSheetModal>(null);

  const handleDeleteConfirm = React.useCallback(async () => {
    const result = await deleteMutation.mutateAsync({
      postId: String(postId),
    });
    optionsSheetRef.current?.dismiss();
    if (result?.undo_expires_at) {
      onDelete?.(postId, result.undo_expires_at);
    }
  }, [deleteMutation, postId, onDelete]);

  return { optionsSheetRef, handleDeleteConfirm };
}
