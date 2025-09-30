/**
 * Type definitions for the send-push-notification Edge Function
 */

export interface NotificationRequest {
  userId: string;
  type:
    | 'community.reply'
    | 'community.like'
    | 'cultivation.reminder'
    | 'system.update';
  title: string;
  body: string;
  data: Record<string, any>;
  deepLink?: string;
  collapseKey?: string;
  threadId?: string;
}

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
}

export interface NotificationPreferences {
  community_interactions?: boolean;
  community_likes?: boolean;
  cultivation_reminders?: boolean;
  system_updates?: boolean;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  platform: string;
  providerMessageName: string | null;
  error: string | null;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string; // Android only
  categoryId?: string; // iOS only
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string; // Ticket ID for receipt polling
  message?: string; // Error message if status is 'error'
  details?: {
    error?:
      | 'DeviceNotRegistered'
      | 'MessageTooBig'
      | 'MessageRateExceeded'
      | 'InvalidCredentials';
  };
}

export interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

export interface NotificationQueueRow {
  user_id: string;
  message_id: string;
  type: string;
  payload_summary: {
    platform: string;
    keys: string[];
    has_deeplink: boolean;
  };
  provider_message_name: string | null;
  status: 'sent' | 'failed';
  device_token: string;
  platform: string;
  error_message: string | null;
}
