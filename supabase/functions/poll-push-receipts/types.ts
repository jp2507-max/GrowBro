/**
 * Type definitions for the poll-push-receipts Edge Function
 */

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?:
      | 'DeviceNotRegistered'
      | 'MessageTooBig'
      | 'MessageRateExceeded'
      | 'InvalidCredentials';
  };
}

export interface ExpoPushReceiptsResponse {
  data: Record<string, ExpoPushReceipt>;
}

export interface NotificationQueueEntry {
  id: string;
  provider_message_name: string;
  device_token: string;
  platform: string;
  user_id: string;
}

export interface TokenDeactivationRequest {
  token: string;
  platform: string;
  reason: string;
}
