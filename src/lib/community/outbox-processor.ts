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
import { z } from 'zod';

import { getCommunityApiClient } from '@/api/community/client';
import { calculateBackoffDelay } from '@/lib/utils/backoff';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { OutboxOperation } from '@/types/community';

import { communityMetrics } from './metrics-tracker';

// Payload validation schemas
const PostIdPayloadSchema = z.object({
  postId: z.string(),
});

const CommentIdPayloadSchema = z.object({
  commentId: z.string(),
});

const CommentPayloadSchema = z.object({
  postId: z.string(),
  body: z.string(),
});

const ModerateContentPayloadSchema = z.object({
  contentType: z.enum(['post', 'comment']),
  contentId: z.string(),
  action: z.enum(['hide', 'unhide']),
  reason: z.string().optional(),
});

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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[OutboxProcessor] Entry not found for retry ${entryId}:`,
        errorMessage
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[OutboxProcessor] Entry not found for cancel ${entryId}:`,
          errorMessage
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[OutboxProcessor] Entry ${entry.id} failed:`,
        errorMessage
      );

      // Track mutation failure (Requirement 10.5)
      communityMetrics.recordMutationFailure();

      // Handle specific error cases
      const hasNotFoundStatus =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response &&
        error.response.status === 404;

      if (hasNotFoundStatus) {
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
      const nextRetryDelay = this.calculateBackoff(entry.retries);
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
    payload: Record<string, unknown>;
    idempotencyKey: string;
    clientTxId: string;
  }): Promise<void> {
    const { op, payload, idempotencyKey, clientTxId } = params;
    const handlers: Record<OutboxOperation, () => Promise<void>> = {
      LIKE: () => this.executeLike(payload, idempotencyKey, clientTxId),
      UNLIKE: () => this.executeUnlike(payload, idempotencyKey, clientTxId),
      COMMENT: () => this.executeComment(payload, idempotencyKey, clientTxId),
      DELETE_POST: () =>
        this.executeDeletePost(payload, idempotencyKey, clientTxId),
      DELETE_COMMENT: () =>
        this.executeDeleteComment(payload, idempotencyKey, clientTxId),
      UNDO_DELETE_POST: () =>
        this.executeUndoDeletePost(payload, idempotencyKey, clientTxId),
      UNDO_DELETE_COMMENT: () =>
        this.executeUndoDeleteComment(payload, idempotencyKey, clientTxId),
      MODERATE_CONTENT: () =>
        this.executeModerateContent(payload, idempotencyKey, clientTxId),
    };

    const handler = handlers[op];
    if (!handler) throw new Error(`Unknown operation: ${op}`);
    await handler();
  }

  private async executeLike(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = PostIdPayloadSchema.parse(payload);
    await this.apiClient.likePost(validated.postId, idempotencyKey, clientTxId);
  }

  private async executeUnlike(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = PostIdPayloadSchema.parse(payload);
    await this.apiClient.unlikePost(
      validated.postId,
      idempotencyKey,
      clientTxId
    );
  }

  private async executeComment(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = CommentPayloadSchema.parse(payload);
    await this.apiClient.createComment(
      { postId: validated.postId, body: validated.body },
      idempotencyKey,
      clientTxId
    );
  }

  private async executeDeletePost(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = PostIdPayloadSchema.parse(payload);
    await this.apiClient.deletePost(
      validated.postId,
      idempotencyKey,
      clientTxId
    );
  }

  private async executeDeleteComment(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = CommentIdPayloadSchema.parse(payload);
    await this.apiClient.deleteComment(
      validated.commentId,
      idempotencyKey,
      clientTxId
    );
  }

  private async executeUndoDeletePost(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = PostIdPayloadSchema.parse(payload);
    await this.apiClient.undoDeletePost(
      validated.postId,
      idempotencyKey,
      clientTxId
    );
  }

  private async executeUndoDeleteComment(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = CommentIdPayloadSchema.parse(payload);
    await this.apiClient.undoDeleteComment(
      validated.commentId,
      idempotencyKey,
      clientTxId
    );
  }

  private async executeModerateContent(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    clientTxId: string
  ): Promise<void> {
    const validated = ModerateContentPayloadSchema.parse(payload);
    await this.apiClient.moderateContent({
      contentType: validated.contentType,
      contentId: validated.contentId,
      action: validated.action,
      reason: validated.reason,
      idempotencyKey,
      clientTxId,
    });
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retries: number): number {
    return calculateBackoffDelay(retries, this.BASE_DELAY, this.MAX_DELAY);
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
