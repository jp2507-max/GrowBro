/**
 * useUnhideContent hook
 *
 * React Query mutation for unhiding content (posts/comments).
 * Requirements: 7.2, 7.6, 10.3
 */

import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import {
  communityPostKey,
  isCommunityCommentsKey,
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from '@/lib/community/query-keys';
import { supabase } from '@/lib/supabase';

type UnhideContentParams = {
  contentType: 'post' | 'comment';
  contentId: string;
  idempotencyKey?: string;
};

type UnhideContentResult = {
  success: boolean;
};

async function unhideContent({
  contentType,
  contentId,
  idempotencyKey: providedIdempotencyKey,
}: UnhideContentParams): Promise<UnhideContentResult> {
  const idempotencyKey = providedIdempotencyKey || randomUUID();

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

export function useUnhideContent(): UseMutationResult<
  UnhideContentResult,
  Error,
  UnhideContentParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unhideContent,
    onSuccess: (_data, variables): void => {
      // Invalidate relevant queries
      if (variables.contentType === 'post') {
        void queryClient.invalidateQueries({
          predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
        });
        void queryClient.invalidateQueries({
          predicate: (query) => isCommunityUserPostsKey(query.queryKey),
        });
        void queryClient.invalidateQueries({
          queryKey: communityPostKey(variables.contentId),
        });
      } else {
        void queryClient.invalidateQueries({
          predicate: (query) => isCommunityCommentsKey(query.queryKey),
        });
      }
    },
  });
}
