/**
 * useHideContent hook
 *
 * React Query mutation for hiding content (posts/comments) with moderation reason.
 * Uses WatermelonDB outbox pattern for offline-first architecture.
 * Requirements: 7.2, 7.6, 10.3
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';

import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';

type HideContentParams = {
  contentType: 'post' | 'comment';
  contentId: string;
  reason: string;
};

type HideContentResult = {
  success: boolean;
  queuedAt: string;
};

async function hideContent({
  contentType,
  contentId,
  reason,
}: HideContentParams): Promise<HideContentResult> {
  // Generate client transaction ID and idempotency key
  const clientTxId = uuidv4();
  const idempotencyKey = uuidv4();

  // Queue moderation action in outbox for offline support
  await database.write(async () => {
    const outboxCollection = database.get<OutboxModel>('outbox');
    await outboxCollection.create((record) => {
      record.op = 'MODERATE_CONTENT';
      record.payload = {
        contentType,
        contentId,
        action: 'hide',
        reason,
      };
      record.clientTxId = clientTxId;
      record.idempotencyKey = idempotencyKey;
      record.createdAt = new Date();
      record.retries = 0;
      record.status = 'pending';
    });
  });

  return {
    success: true,
    queuedAt: new Date().toISOString(),
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
