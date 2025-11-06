import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { processAttachments } from '@/lib/support/attachment-processor';
import { captureDeviceContext } from '@/lib/support/device-context';
import {
  getPendingTickets,
  getQueuedTickets,
  isReadyForRetry,
  markTicketForRetry,
  markTicketSent,
  queueTicket,
} from '@/lib/support/ticket-queue';
import type { SupportCategory, SupportTicket } from '@/types/support';

const SUPPORT_TICKETS_QUERY_KEY = 'supportTickets';
const PENDING_TICKETS_QUERY_KEY = 'pendingTickets';

export interface SubmitTicketData {
  category: SupportCategory;
  subject: string;
  description: string;
  imageUris: string[];
  lastRoute?: string;
  sentryEventId?: string;
}

/**
 * Hook to submit support tickets
 */
export function useSubmitSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubmitTicketData) => {
      // Capture device context
      const deviceContext = await captureDeviceContext(
        data.lastRoute,
        data.sentryEventId
      );

      // Process attachments
      const result = await processAttachments(data.imageUris);
      if (!result.success) {
        throw new Error(result.error || 'Failed to process attachments');
      }

      // Queue ticket
      const clientRequestId = await queueTicket(
        data.category,
        data.subject,
        data.description,
        deviceContext,
        result.attachments || []
      );

      return { clientRequestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [SUPPORT_TICKETS_QUERY_KEY],
      });
      queryClient.invalidateQueries({
        queryKey: [PENDING_TICKETS_QUERY_KEY],
      });
    },
  });
}

/**
 * Hook to get all support tickets (history)
 */
export function useSupportTickets() {
  return useQuery({
    queryKey: [SUPPORT_TICKETS_QUERY_KEY],
    queryFn: getQueuedTickets,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to get pending tickets for sync
 */
export function usePendingSupportTickets() {
  return useQuery({
    queryKey: [PENDING_TICKETS_QUERY_KEY],
    queryFn: async () => {
      const pending = await getPendingTickets();
      // Filter to only ready for retry
      return pending.filter(isReadyForRetry);
    },
    staleTime: 1000 * 10, // 10 seconds
  });
}

/**
 * Hook to sync queued tickets with backend
 */
export function useSyncSupportTickets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tickets: SupportTicket[]) => {
      const results: { clientRequestId: string; success: boolean }[] = [];

      for (const ticket of tickets) {
        try {
          // TODO: Submit to Supabase Edge Function
          // For now, simulate success
          const ticketReference = `TKT-${Date.now()}`;

          await markTicketSent(ticket.id, ticketReference);
          results.push({ clientRequestId: ticket.id, success: true });
        } catch (error) {
          console.error('Failed to sync ticket:', error);
          await markTicketForRetry(ticket.id);
          results.push({ clientRequestId: ticket.id, success: false });
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [SUPPORT_TICKETS_QUERY_KEY],
      });
      queryClient.invalidateQueries({
        queryKey: [PENDING_TICKETS_QUERY_KEY],
      });
    },
  });
}
