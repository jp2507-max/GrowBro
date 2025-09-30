/**
 * Type definitions for the process-notification-requests Edge Function
 */

export interface NotificationRequestEntry {
  id: string;
  user_id: string;
  created_by: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  deep_link: string | null;
  created_at: string;
}

export interface ProcessingStats {
  processed: number;
  succeeded: number;
  failed: number;
  errors: {
    requestId: string;
    error: string;
  }[];
}
