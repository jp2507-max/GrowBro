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
};

type UnhideContentResult = {
  success: boolean;
};

async function unhideContent({
  contentType,
  contentId,
}: UnhideContentParams): Promise<UnhideContentResult> {
  const idempotencyKey = `${contentType}-${contentId}-unhide-${Date.now()}`;

  const { data, error } = await supabase.rpc('moderate_content', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_action: 'unhide',
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`Failed to unhide ${contentType}: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error(`RPC failed: ${data?.error || 'Unknown error'}`);
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
