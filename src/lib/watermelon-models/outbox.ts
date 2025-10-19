import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type {
  OutboxOperation,
  OutboxPayload,
  OutboxStatus,
} from '@/types/community';

export class OutboxModel extends Model {
  static table = 'outbox';

  @text('op') op!: OutboxOperation;
  @json('payload', (raw) => raw as OutboxPayload) payload!: OutboxPayload;
  @text('client_tx_id') clientTxId!: string;
  @text('idempotency_key') idempotencyKey!: string;
  @date('created_at') createdAt!: Date;
  @field('retries') retries!: number;
  @date('next_retry_at') nextRetryAt?: Date;
  @text('status') status!: OutboxStatus;

  // Check if entry is pending
  get isPending(): boolean {
    return this.status === 'pending';
  }

  // Check if entry has failed
  get hasFailed(): boolean {
    return this.status === 'failed';
  }

  // Check if entry is processed
  get isProcessed(): boolean {
    return this.status === 'processed';
  }

  // Check if entry should be retried
  get shouldRetry(): boolean {
    if (this.status !== 'pending' && this.status !== 'failed') {
      return false;
    }
    if (!this.nextRetryAt) {
      return true; // No retry timestamp set, should retry immediately
    }
    return Date.now() >= this.nextRetryAt.getTime();
  }

  // Calculate next retry delay (exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s max)
  getNextRetryDelay(): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 32000; // 32 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.retries), maxDelay);
    return delay;
  }

  // Check if max retries exceeded (5 attempts)
  get hasExceededMaxRetries(): boolean {
    return this.retries >= 5;
  }
}
