import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

export type NotificationActionType = 'schedule' | 'cancel';
export type OutboxStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export interface NotificationActionPayload {
  notificationId: string;
  taskId: string;
  triggerTime?: string;
  channel?: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export class OutboxNotificationActionModel extends Model {
  static table = 'outbox_notification_actions';

  @text('action_type') actionType!: NotificationActionType;
  @json('payload', (raw) => raw as NotificationActionPayload)
  payload!: NotificationActionPayload;
  @text('business_key') businessKey?: string;
  @field('ttl') ttl!: number;
  @field('expires_at') expiresAt!: number;
  @field('next_attempt_at') nextAttemptAt!: number;
  @field('attempted_count') attemptedCount!: number;
  @text('status') status!: OutboxStatus;
  @text('last_error') lastError?: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
