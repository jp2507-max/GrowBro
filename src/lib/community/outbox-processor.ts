/**
 * Outbox Processor
 *
 * Processes offline actions queued in WatermelonDB outbox table with:
 * - FIFO queue processing
 * - Exponential backoff (1s → 32s)
 * - Max 5 retries before marking as failed
 * - Idempotency key preservation across retries
 * - Self-echo detection via client_tx_id
 */

import { type Database, Q } from '@nozbe/watermelondb';

import { getCommunityApiClient } from '@/api/community/client';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { OutboxOperation } from '@/types/community';

import { communityMetrics } from './metrics-tracker';

export interface OutboxProcessorOptions {
  database: Database;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface OutboxCounts {
  pending: number;
  failed: number;
  processed: number;
  total: number;
}

export class OutboxProcessor {
  private database: Database;
  private apiClient = getCommunityApiClient();
  private readonly MAX_RETRIES: number;
  private readonly BASE_DELAY: number;
  private readonly MAX_DELAY: number;
  private isProcessing = false;

  constructor(options: OutboxProcessorOptions) {
    this.database = options.database;
    this.MAX_RETRIES = options.maxRetries ?? 5;
    this.BASE_DELAY = options.baseDelayMs ?? 1000;
    this.MAX_DELAY = options.maxDelayMs ?? 32000;
  }

  /**
   * Process all pending outbox entries in FIFO order
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[OutboxProcessor] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const outboxCollection = this.database.get<OutboxModel>('outbox');

      // Fetch pending entries sorted by created_at ASC (FIFO)
      const pendingEntries = await outboxCollection
        .query(
          Q.or(Q.where('status', 'pending'), Q.where('status', 'failed')),
          Q.sortBy('created_at', Q.asc)
        )
        .fetch();

      console.log(
        `[OutboxProcessor] Processing ${pendingEntries.length} entries`
      );

      for (const entry of pendingEntries) {
        // Skip if not ready for retry
        if (!entry.shouldRetry) {
          console.log(
            `[OutboxProcessor] Skipping entry ${entry.id}, not ready for retry`
          );
          continue;
        }

        // Skip if max retries exceeded
        if (entry.hasExceededMaxRetries) {
          console.log(
            `[OutboxProcessor] Entry ${entry.id} exceeded max retries, marking as failed`
          );
          await this.markAsFailed(entry);
          continue;
        }

        await this.processEntry(entry);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a specific failed entry
   */
  async retryEntry(entryId: string): Promise<void> {
    const outboxCollection = this.database.get<OutboxModel>('outbox');
    let entry: OutboxModel;

    try {
      entry = await outboxCollection.find(entryId);
    } catch (error: any) {
      console.error(
        `[OutboxProcessor] Entry not found for retry ${entryId}:`,
        error.message
      );
      throw new Error(`Outbox entry not found for retry: ${entryId}`);
    }

    if (entry.status !== 'failed') {
      throw new Error('Can only retry failed entries');
    }

    await this.processEntry(entry);
  }

  /**
   * Delete a failed entry (cancel operation)
   */
  async cancelEntry(entryId: string): Promise<void> {
    await this.database.write(async () => {
      const outboxCollection = this.database.get<OutboxModel>('outbox');
      let entry: OutboxModel;

      try {
        entry = await outboxCollection.find(entryId);
      } catch (error: any) {
        console.error(
          `[OutboxProcessor] Entry not found for cancel ${entryId}:`,
          error.message
        );
        // Entry already doesn't exist, so cancel is effectively complete
        return;
      }

      await entry.destroyPermanently();
    });
  }

  /**
   * Confirm an entry (called when self-echo detected via client_tx_id)
   */
  async confirmEntry(clientTxId: string): Promise<void> {
    const outboxCollection = this.database.get<OutboxModel>('outbox');
    const entries = await outboxCollection
      .query(Q.where('client_tx_id', clientTxId))
      .fetch();

    if (entries.length === 0) {
      return; // No matching entry, already processed
    }

    await this.database.write(async () => {
      for (const entry of entries) {
        await entry.update((record) => {
          record.status = 'processed';
        });
      }
    });

    console.log(
      `[OutboxProcessor] Processed ${entries.length} entries with client_tx_id: ${clientTxId}`
    );
  }

  /**
   * Get current outbox status
   */
  async getStatus(): Promise<OutboxCounts> {
    const outboxCollection = this.database.get<OutboxModel>('outbox');
    const allEntries = await outboxCollection.query().fetch();

    const status: OutboxCounts = {
      pending: 0,
      failed: 0,
      processed: 0,
      total: allEntries.length,
    };

    for (const entry of allEntries) {
      if (entry.isPending) status.pending++;
      else if (entry.hasFailed) status.failed++;
      else if (entry.isProcessed) status.processed++;
    }

    // Update metrics tracker (Requirement 10.5)
    communityMetrics.updateOutboxMetrics({
      depth: allEntries.length,
      pending: status.pending,
      failed: status.failed,
      processed: status.processed,
    });

    return status;
  }

  /**
   * Clear processed entries (cleanup)
   */
  async clearProcessed(): Promise<number> {
    const outboxCollection = this.database.get<OutboxModel>('outbox');
    const processedEntries = await outboxCollection
      .query(Q.where('status', 'processed'))
      .fetch();

    await this.database.write(async () => {
      for (const entry of processedEntries) {
        await entry.destroyPermanently();
      }
    });

    return processedEntries.length;
  }

  /**
   * Process a single outbox entry
   */
  private async processEntry(entry: OutboxModel): Promise<void> {
    console.log(
      `[OutboxProcessor] Processing entry ${entry.id}, op: ${entry.op}, attempt: ${entry.retries + 1}`
    );

    try {
      // Parse payload
      const payload = entry.payload;

      // Execute operation based on type
      await this.executeOperation({
        op: entry.op,
        payload,
        idempotencyKey: entry.idempotencyKey,
        clientTxId: entry.clientTxId,
      });

      // Mark as processed on success
      await this.database.write(async () => {
        await entry.update((record) => {
          record.status = 'processed';
        });
      });

      console.log(`[OutboxProcessor] Entry ${entry.id} processed`);

      // Track successful mutation (Requirement 10.5)
      communityMetrics.recordMutationSuccess();
    } catch (error: any) {
      console.error(
        `[OutboxProcessor] Entry ${entry.id} failed:`,
        error.message
      );

      // Track mutation failure (Requirement 10.5)
      communityMetrics.recordMutationFailure();

      // Handle specific error cases
      if (error.response?.status === 404) {
        // Target content deleted, drop the action
        await this.database.write(async () => {
          await entry.destroyPermanently();
        });
        console.log(`[OutboxProcessor] Entry ${entry.id} dropped (404)`);
        // TODO: Show toast "Content no longer available"
        return;
      }

      // Increment retry count and calculate next retry time
      const nextRetries = entry.retries + 1;
      const nextRetryDelay = this.calculateBackoff(nextRetries);
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);

      await this.database.write(async () => {
        await entry.update((record) => {
          record.retries = nextRetries;
          record.nextRetryAt = nextRetryAt;
          record.status =
            nextRetries >= this.MAX_RETRIES ? 'failed' : 'pending';
        });
      });

      console.log(
        `[OutboxProcessor] Entry ${entry.id} will retry in ${nextRetryDelay}ms`
      );
    }
  }

  /**
   * Execute the appropriate API operation
   */
  private async executeOperation(params: {
    op: OutboxOperation;
    payload: any;
    idempotencyKey: string;
    clientTxId: string;
  }): Promise<void> {
    const { op, payload, idempotencyKey, clientTxId } = params;
    switch (op) {
      case 'LIKE':
        await this.apiClient.likePost(
          payload.postId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'UNLIKE':
        await this.apiClient.unlikePost(
          payload.postId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'COMMENT':
        await this.apiClient.createComment(
          {
            post_id: payload.post_id,
            body: payload.body,
          },
          idempotencyKey,
          clientTxId
        );
        break;

      case 'DELETE_POST':
        await this.apiClient.deletePost(
          payload.postId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'DELETE_COMMENT':
        await this.apiClient.deleteComment(
          payload.commentId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'UNDO_DELETE_POST':
        await this.apiClient.undoDeletePost(
          payload.postId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'UNDO_DELETE_COMMENT':
        await this.apiClient.undoDeleteComment(
          payload.commentId,
          idempotencyKey,
          clientTxId
        );
        break;

      case 'MODERATE_CONTENT':
        await this.apiClient.moderateContent({
          contentType: payload.contentType,
          contentId: payload.contentId,
          action: payload.action,
          reason: payload.reason,
          idempotencyKey,
          clientTxId,
        });
        break;

      default:
        throw new Error(`Unknown operation: ${op}`);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retries: number): number {
    return Math.min(this.BASE_DELAY * Math.pow(2, retries), this.MAX_DELAY);
  }

  /**
   * Mark entry as failed
   */
  private async markAsFailed(entry: OutboxModel): Promise<void> {
    await this.database.write(async () => {
      await entry.update((record) => {
        record.status = 'failed';
      });
    });
  }
}

// Singleton instance
let outboxProcessorInstance: OutboxProcessor | null = null;

/**
 * Get or create the singleton OutboxProcessor instance
 */
export function getOutboxProcessor(database: Database): OutboxProcessor {
  if (!outboxProcessorInstance) {
    outboxProcessorInstance = new OutboxProcessor({ database });
  }
  return outboxProcessorInstance;
}
