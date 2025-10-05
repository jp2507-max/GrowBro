/**
 * Outbox Worker
 *
 * Processes notification actions from the outbox table with:
 * - Idempotent processing using business_key
 * - Exponential backoff with jitter for retries
 * - Atomic row claiming for concurrent safety
 * - TTL/expiry cleanup
 * - Crash-safe operation
 */

import { type Database, Q } from '@nozbe/watermelondb';

import type { OutboxNotificationActionModel } from '../watermelon-models/outbox-notification-action';

export interface OutboxWorkerOptions {
  database: Database;
  notificationScheduler: {
    scheduleNotification: (params: {
      notificationId: string;
      taskId: string;
      triggerTime: string;
      title: string;
      body: string;
      data?: Record<string, any>;
    }) => Promise<void>;
    cancelNotification: (notificationId: string) => Promise<void>;
  };
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class OutboxWorker {
  private database: Database;
  private notificationScheduler: OutboxWorkerOptions['notificationScheduler'];
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private isRunning = false;
  private processInterval?: NodeJS.Timeout;

  constructor(options: OutboxWorkerOptions) {
    this.database = options.database;
    this.notificationScheduler = options.notificationScheduler;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 60000;
  }

  /**
   * Start the worker to process outbox actions
   */
  start(intervalMs: number = 5000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processInterval = setInterval(() => {
      this.processPendingActions().catch((error) => {
        console.error('[OutboxWorker] Error processing actions:', error);
      });
    }, intervalMs);

    // Process immediately on start
    this.processPendingActions().catch((error) => {
      console.error('[OutboxWorker] Error processing actions:', error);
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = undefined;
    }
    this.isRunning = false;
  }

  /**
   * Process pending actions from the outbox
   */
  async processPendingActions(): Promise<void> {
    const now = Date.now();

    // Clean up expired actions first
    await this.cleanupExpiredActions(now);

    // Get pending actions that are ready to process
    const pendingActions = await this.database
      .get<OutboxNotificationActionModel>('outbox_notification_actions')
      .query(
        Q.where('status', Q.oneOf(['pending', 'failed'])),
        Q.where('next_attempt_at', Q.lte(now)),
        Q.where('expires_at', Q.gt(now)),
        Q.sortBy('next_attempt_at', Q.asc),
        Q.take(10) // Process in batches
      )
      .fetch();

    for (const action of pendingActions) {
      await this.processAction(action);
    }
  }

  /**
   * Process a single outbox action
   */
  private async processAction(
    action: OutboxNotificationActionModel
  ): Promise<void> {
    try {
      // Atomically claim the action
      const claimed = await this.claimAction(action);
      if (!claimed) return; // Another worker claimed it

      // Process based on action type
      if (action.actionType === 'schedule') {
        await this.processScheduleAction(action);
      } else if (action.actionType === 'cancel') {
        await this.processCancelAction(action);
      }

      // Mark as completed
      await this.markCompleted(action);
    } catch (error) {
      await this.handleError(action, error);
    }
  }

  /**
   * Atomically claim an action for processing
   */
  private async claimAction(
    action: OutboxNotificationActionModel
  ): Promise<boolean> {
    try {
      let claimed = false;
      await this.database.write(async () => {
        await action.update((record) => {
          // Only claim if still pending/failed
          if (record.status === 'pending' || record.status === 'failed') {
            record.status = 'processing';
            record.attemptedCount = record.attemptedCount + 1;
            claimed = true;
          }
        });
      });
      return claimed;
    } catch {
      // Another worker may have claimed it
      return false;
    }
  }

  /**
   * Process a schedule action
   */
  private async processScheduleAction(
    action: OutboxNotificationActionModel
  ): Promise<void> {
    const { payload } = action;

    if (!payload.triggerTime || !payload.title || !payload.body) {
      throw new Error('Invalid schedule action payload');
    }

    await this.notificationScheduler.scheduleNotification({
      notificationId: payload.notificationId,
      taskId: payload.taskId,
      triggerTime: payload.triggerTime,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }

  /**
   * Process a cancel action
   */
  private async processCancelAction(
    action: OutboxNotificationActionModel
  ): Promise<void> {
    const { payload } = action;
    await this.notificationScheduler.cancelNotification(payload.notificationId);
  }

  /**
   * Mark action as completed
   */
  private async markCompleted(
    action: OutboxNotificationActionModel
  ): Promise<void> {
    await this.database.write(async () => {
      await action.update((record) => {
        record.status = 'completed';
      });
    });
  }

  /**
   * Handle processing error with exponential backoff
   */
  private async handleError(
    action: OutboxNotificationActionModel,
    error: unknown
  ): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    await this.database.write(async () => {
      await action.update((record) => {
        if (record.attemptedCount >= this.maxRetries) {
          record.status = 'failed';
          record.lastError = `Max retries exceeded: ${errorMessage}`;
          record.nextAttemptAt = null;
        } else {
          record.status = 'failed';
          record.lastError = errorMessage;
          record.nextAttemptAt = this.calculateNextAttempt(
            record.attemptedCount
          );
        }
      });
    });
  }

  /**
   * Calculate next attempt time with exponential backoff and jitter
   */
  private calculateNextAttempt(attemptCount: number): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attemptCount);
    const jitter = Math.random() * this.baseDelayMs;
    const delay = Math.min(exponentialDelay + jitter, this.maxDelayMs);
    return Date.now() + delay;
  }

  /**
   * Clean up expired actions
   */
  private async cleanupExpiredActions(now: number): Promise<void> {
    const expiredActions = await this.database
      .get<OutboxNotificationActionModel>('outbox_notification_actions')
      .query(Q.where('expires_at', Q.lte(now)))
      .fetch();

    if (expiredActions.length > 0) {
      await this.database.write(async () => {
        for (const action of expiredActions) {
          await action.update((record) => {
            if (record.status === 'pending') {
              record.status = 'expired';
            }
          });
        }
      });
    }

    // Delete completed/expired actions older than 24 hours
    const cleanupThreshold = now - 24 * 60 * 60 * 1000;
    const oldActions = await this.database
      .get<OutboxNotificationActionModel>('outbox_notification_actions')
      .query(
        Q.where('status', Q.oneOf(['completed', 'expired'])),
        Q.where('created_at', Q.lte(cleanupThreshold))
      )
      .fetch();

    if (oldActions.length > 0) {
      await this.database.write(async () => {
        for (const action of oldActions) {
          await action.destroyPermanently();
        }
      });
    }
  }

  /**
   * Process all pending actions immediately (for testing)
   */
  async processAllPending(): Promise<void> {
    await this.processPendingActions();
  }
}
