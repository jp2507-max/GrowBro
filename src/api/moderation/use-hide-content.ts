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
  idempotencyKey?: string;
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
  const table = contentType === 'post' ? 'posts' : 'post_comments';
  const now = new Date().toISOString();

  // Update the content to set hidden_at and moderation_reason
  const { error } = await supabase
    .from(table)
    .update({
      hidden_at: now,
      moderation_reason: reason,
      updated_at: now,
    })
    .eq('id', contentId);

  if (error) {
    throw new Error(`Failed to hide ${contentType}: ${error.message}`);
  }

  // Log to moderation_audit
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('moderation_audit').insert({
      moderator_id: user.id,
      content_type: contentType,
      content_id: contentId,
      action: 'hide',
      reason,
    });
  }

  return {
    success: true,
    hiddenAt: now,
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
          queryKey: ['post', variables.contentId],
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['comments'] });
        void queryClient.invalidateQueries({
          queryKey: ['comment', variables.contentId],
        });
      }
    },
  });
}
