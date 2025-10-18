/**
 * useHideContent hook
 *
 * React Query mutation for hiding content (posts/comments) with moderation reason.
 * Requirements: 7.2, 7.6, 10.3
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type HideContentParams = {
  contentType: 'post' | 'comment';
  contentId: string;
  reason: string;
};

type HideContentResult = {
  success: boolean;
  hiddenAt: string;
};

async function hideContent({
  contentType,
  contentId,
  reason,
}: HideContentParams): Promise<HideContentResult> {
  // Generate idempotency key for this operation
  const idempotencyKey = crypto.randomUUID();

  // Call the server-side RPC for atomic moderation
  const { data, error } = await supabase.rpc('moderate_content', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_action: 'hide',
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`Failed to hide ${contentType}: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error(
      `Failed to hide ${contentType}: ${data?.error || 'Unknown error'}`
    );
  }

  return {
    success: true,
    hiddenAt: data.moderated_at,
  };
}

export function useHideContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hideContent,
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      if (variables.contentType === 'post') {
        void queryClient.invalidateQueries({ queryKey: ['posts'] });
        void queryClient.invalidateQueries({
          queryKey: ['post', 'postId'],
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
  });
}
