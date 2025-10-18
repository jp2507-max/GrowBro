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
  // Determine the table based on content type
  const table = contentType === 'post' ? 'posts' : 'comments';

  // Perform the update and select the updated rows
  const { data, error } = await supabase
    .from(table)
    .update({ hidden: false })
    .eq('id', contentId)
    .select('*');

  if (error) {
    throw new Error(`Failed to unhide ${contentType}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `No rows were updated for ${contentType} with id ${contentId}. Possible RLS policy violation or invalid id.`
    );
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
