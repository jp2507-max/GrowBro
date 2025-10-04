import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { OutboxNotificationAction as OutboxNotificationActionType } from '@/types/playbook';

/**
 * Outbox Notification Action Model
 * Queues notification operations for atomic scheduling with DB transactions
 */
export class OutboxNotificationActionModel extends Model {
  static table = 'outbox_notification_actions';

  @text('action_type') actionType!: 'schedule' | 'cancel';

  @json('payload', (raw) => raw as OutboxNotificationActionType['payload'])
  payload!: OutboxNotificationActionType['payload'];

  @text('business_key') businessKey?: string;
  @field('ttl') ttl!: number;
  @field('expires_at') expiresAt!: number;
  @field('next_attempt_at') nextAttemptAt!: number;
  @field('attempted_count') attemptedCount!: number;

  @text('status')
  status!: 'pending' | 'processing' | 'completed' | 'expired' | 'failed';

  @text('last_error') lastError?: string;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  /**
   * Check if this action has expired
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Check if this action is ready for retry
   */
  isReadyForRetry(): boolean {
    return (
      this.status === 'failed' &&
      Date.now() >= this.nextAttemptAt &&
      !this.isExpired()
    );
  }

  /**
   * Convert model to plain object
   */
  toOutboxAction(): OutboxNotificationActionType {
    return {
      id: this.id,
      actionType: this.actionType,
      payload: this.payload,
      businessKey: this.businessKey,
      ttl: this.ttl,
      expiresAt: this.expiresAt,
      nextAttemptAt: this.nextAttemptAt,
      attemptedCount: this.attemptedCount,
      status: this.status,
      lastError: this.lastError,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
