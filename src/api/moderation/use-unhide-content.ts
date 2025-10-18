/**
 * useUnhideContent hook
 *
 * React Query mutation for unhiding content (posts/comments).
 * Requirements: 7.2, 7.6, 10.3
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type UnhideContentParams = {
  contentType: 'post' | 'comment';
  contentId: string;
  reason: string;
};

type UnhideContentResult = {
  success: boolean;
};

async function unhideContent({
  contentType,
  contentId,
  reason,
}: UnhideContentParams): Promise<UnhideContentResult> {
  const table = contentType === 'post' ? 'posts' : 'post_comments';
  const now = new Date().toISOString();

  // Update the content to clear hidden_at and moderation_reason
  const { error } = await supabase
    .from(table)
    .update({
      hidden_at: null,
      moderation_reason: null,
      updated_at: now,
    })
    .eq('id', contentId);

  if (error) {
    throw new Error(`Failed to unhide ${contentType}: ${error.message}`);
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
      action: 'unhide',
      reason,
    });
  }

  return {
    success: true,
  };
}

export function useUnhideContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unhideContent,
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
