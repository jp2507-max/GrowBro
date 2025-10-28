import type { Collection } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { isMetered, isOnline } from '@/lib/sync/network-manager';
import { calculateBackoffDelayWithJitter } from '@/lib/utils/backoff';
import { database } from '@/lib/watermelon';
import type { AssessmentRequestModel } from '@/lib/watermelon-models/assessment-request';
import type {
  AssessmentPlantContext,
  AssessmentRequestData,
  CapturedPhoto,
  ProcessingResult,
  QueueStatus,
} from '@/types/assessment';

import { batchProcessor } from './batch-processor';
import { CloudInferenceClient } from './cloud-inference-client';
import { classifyError } from './error-classifier';

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_MAX_QUEUE_SIZE = 150;
const DEFAULT_COMPLETED_RETENTION_DAYS = 14;
const DEFAULT_FAILED_RETENTION_DAYS = 30;

type OfflineQueueConfig = {
  maxQueueSize?: number;
  completedRetentionDays?: number;
  failedRetentionDays?: number;
};

/**
 * Offline queue manager for assessment requests
 * Handles queuing, retry logic, and batch processing of assessment requests
 */
export class OfflineQueueManager {
  private readonly maxQueueSize: number;
  private readonly completedRetentionMs: number;
  private readonly failedRetentionMs: number;
  private _processing = false;

  constructor(config: OfflineQueueConfig = {}) {
    this.maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.completedRetentionMs =
      (config.completedRetentionDays ?? DEFAULT_COMPLETED_RETENTION_DAYS) *
      MS_IN_DAY;
    this.failedRetentionMs =
      (config.failedRetentionDays ?? DEFAULT_FAILED_RETENTION_DAYS) * MS_IN_DAY;
  }

  /**
   * Enqueue a new assessment request
   * Returns the request ID
   */
  async enqueue(params: {
    plantId: string;
    userId: string;
    photos: CapturedPhoto[];
    plantContext: AssessmentPlantContext;
  }): Promise<string> {
    const { plantId, userId, photos, plantContext } = params;

    await this.cleanupStoragePolicy();

    const request = await database.write(async () => {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );
      return await collection.create((record) => {
        record.plantId = plantId;
        record.userId = userId;
        record.status = 'pending';
        record.photos = photos;
        record.plantContext = plantContext;
        record.retryCount = 0;
        record.originalTimestamp = Date.now();
      });
    });

    await this.cleanupStoragePolicy();

    return request.id;
  }

  /**
   * Process all pending requests in the queue
   * Returns array of processing results
   */
  async processQueue(): Promise<ProcessingResult[]> {
    // Re-entry guard
    if (this._processing) {
      return [];
    }

    // Check network connectivity first
    const online = await isOnline();
    if (!online) {
      return [];
    }

    this._processing = true;

    try {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );

      // Get all pending or failed requests that are ready to retry
      const requests = await collection
        .query(
          Q.or(Q.where('status', 'pending'), Q.where('status', 'failed')),
          Q.sortBy('created_at', Q.asc)
        )
        .fetch();

      // Filter requests that are ready to retry
      const readyRequests = requests.filter(
        (req) => req.shouldRetry && !req.hasExceededMaxRetries
      );

      if (readyRequests.length === 0) {
        return [];
      }

      // Check if connection is metered
      const metered = await isMetered();

      // Process requests in batches
      const results = await batchProcessor.processBatch(
        readyRequests,
        (request) => this.processRequest(request),
        { isMetered: metered }
      );

      await this.cleanupStoragePolicy();

      return results;
    } finally {
      this._processing = false;
    }
  }

  /**
   * Process a single assessment request
   */
  private async processRequest(
    request: AssessmentRequestModel
  ): Promise<ProcessingResult> {
    const cloudClient = new CloudInferenceClient();

    try {
      // Mark as processing
      await database.write(async () => {
        await request.update((record) => {
          record.status = 'processing';
        });
      });

      // Call cloud inference
      const result = await cloudClient.predict({
        photos: request.photos,
        plantContext: request.plantContext,
        assessmentId: request.id,
        idempotencyKey: request.id,
      });

      // Mark as completed
      await database.write(async () => {
        await request.update((record) => {
          record.status = 'completed';
        });
      });

      return {
        requestId: request.id,
        success: true,
        processedAt: Date.now(),
        details: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Classify error to determine retry strategy
      const classification = classifyError(error);

      await database.write(async () => {
        await request.update((record) => {
          // Compute next retry count first
          const nextRetryCount = request.retryCount + 1;
          record.retryCount = nextRetryCount;
          record.lastError = errorMessage;

          // Check if we should retry based on error classification and retry limits
          const shouldRetry = classification.shouldRetry && nextRetryCount < 5;

          if (shouldRetry) {
            // Schedule next retry attempt with backoff
            const delay = calculateBackoffDelayWithJitter(nextRetryCount);
            record.nextAttemptAt = Date.now() + delay;
            record.status = 'failed'; // Keep as failed but with retry scheduled
          } else {
            // Terminal failure - no more retries
            record.nextAttemptAt = undefined;
            record.status = 'failed';
          }
        });
      });

      return {
        requestId: request.id,
        success: false,
        error: errorMessage,
        processedAt: Date.now(),
      };
    }
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    const collection = database.get<AssessmentRequestModel>(
      'assessment_requests'
    );

    const [pending, processing, completed, failed] = await Promise.all([
      collection.query(Q.where('status', 'pending')).fetchCount(),
      collection.query(Q.where('status', 'processing')).fetchCount(),
      collection.query(Q.where('status', 'completed')).fetchCount(),
      collection.query(Q.where('status', 'failed')).fetchCount(),
    ]);

    // Find stalled requests (processing for > 5 minutes)
    const processingRequests = await collection
      .query(Q.where('status', 'processing'))
      .fetch();

    const now = Date.now();
    const stalled = processingRequests.filter((req) => {
      return now - req.updatedAt.getTime() > STALE_THRESHOLD_MS;
    }).length;

    return {
      pending,
      processing,
      completed,
      failed,
      stalled: stalled > 0 ? stalled : undefined,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Retry all failed requests
   */
  async retryFailed(): Promise<void> {
    const collection = database.get<AssessmentRequestModel>(
      'assessment_requests'
    );

    const failedRequests = await collection
      .query(Q.where('status', 'failed'))
      .fetch();

    await database.write(async () => {
      for (const request of failedRequests) {
        if (!request.hasExceededMaxRetries) {
          await request.update((record) => {
            record.status = 'pending';
            record.nextAttemptAt = undefined;
          });
        }
      }
    });
  }

  /**
   * Clear completed requests older than retention period
   */
  async clearCompleted(retentionDays: number = 7): Promise<number> {
    const collection = database.get<AssessmentRequestModel>(
      'assessment_requests'
    );

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const oldCompleted = await collection
      .query(
        Q.where('status', 'completed'),
        Q.where('updated_at', Q.lt(cutoffTime))
      )
      .fetch();

    await database.write(async () => {
      for (const request of oldCompleted) {
        await request.markAsDeleted();
      }
    });

    return oldCompleted.length;
  }

  /**
   * Get request by ID
   */
  async getRequest(requestId: string): Promise<AssessmentRequestData | null> {
    try {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );
      const request = await collection.find(requestId);

      return {
        id: request.id,
        plantId: request.plantId,
        userId: request.userId,
        photos: request.photos,
        plantContext: request.plantContext,
        status: request.status,
        retryCount: request.retryCount,
        lastError: request.lastError,
        nextAttemptAt: request.nextAttemptAt,
        originalTimestamp: request.originalTimestamp,
        createdAt: request.createdAt.getTime(),
        updatedAt: request.updatedAt.getTime(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    try {
      const collection = database.get<AssessmentRequestModel>(
        'assessment_requests'
      );
      const request = await collection.find(requestId);

      if (request.status !== 'pending' && request.status !== 'failed') {
        return false;
      }

      await database.write(async () => {
        await request.markAsDeleted();
      });

      return true;
    } catch {
      return false;
    }
  }

  private async cleanupStoragePolicy(): Promise<void> {
    const collection = database.get<AssessmentRequestModel>(
      'assessment_requests'
    );

    const removalMap = new Map<string, AssessmentRequestModel>();
    const now = Date.now();

    const retentionRemovals = await this.getRetentionRemovals(collection, now);
    retentionRemovals.forEach((record) => removalMap.set(record.id, record));

    const currentCount = await collection.query().fetchCount();
    const effectiveCount = currentCount - removalMap.size;

    if (effectiveCount >= this.maxQueueSize) {
      const overflowRemovals = await this.getOverflowRemovals(
        collection,
        removalMap,
        effectiveCount - this.maxQueueSize + 1
      );
      overflowRemovals.forEach((record) => removalMap.set(record.id, record));
    }

    if (removalMap.size === 0) {
      return;
    }

    await database.write(async () => {
      for (const record of removalMap.values()) {
        try {
          await record.markAsDeleted();
        } catch (error) {
          console.warn('[OfflineQueueManager] Failed to remove stale request', {
            id: record.id,
            error,
          });
        }
      }
    });
  }

  private async getRetentionRemovals(
    collection: Collection<AssessmentRequestModel>,
    now: number
  ): Promise<AssessmentRequestModel[]> {
    const removals: AssessmentRequestModel[] = [];

    if (this.completedRetentionMs >= 0) {
      const cutoff = now - this.completedRetentionMs;
      const completed = await this.fetchRecordsBefore(
        collection,
        'completed',
        cutoff
      );
      removals.push(...completed);
    }

    if (this.failedRetentionMs >= 0) {
      const cutoff = now - this.failedRetentionMs;
      const failed = await this.fetchRecordsBefore(
        collection,
        'failed',
        cutoff
      );
      removals.push(...failed);
    }

    return removals;
  }

  private async getOverflowRemovals(
    collection: Collection<AssessmentRequestModel>,
    removalMap: Map<string, AssessmentRequestModel>,
    overflowCount: number
  ): Promise<AssessmentRequestModel[]> {
    if (overflowCount <= 0) {
      return [];
    }

    const removals: AssessmentRequestModel[] = [];
    let remaining = overflowCount;

    const addRecords = (records: AssessmentRequestModel[]) => {
      for (const record of records) {
        if (remaining <= 0) break;
        if (removalMap.has(record.id)) continue;
        removals.push(record);
        removalMap.set(record.id, record);
        remaining -= 1;
      }
    };

    const completedOrFailed = await collection
      .query(
        Q.where('status', Q.oneOf(['completed', 'failed'] as const)),
        Q.sortBy('updated_at', Q.asc)
      )
      .fetch();
    addRecords(completedOrFailed);

    if (remaining > 0) {
      const pending = await collection
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc))
        .fetch();
      addRecords(pending);
    }

    return removals;
  }

  private async fetchRecordsBefore(
    collection: Collection<AssessmentRequestModel>,
    status: 'completed' | 'failed',
    cutoff: number
  ): Promise<AssessmentRequestModel[]> {
    const conditions = [
      Q.where('status', status),
      Q.where('updated_at', Q.lt(cutoff)),
    ];

    return collection.query(...conditions).fetch();
  }
}

// Singleton instance
export const offlineQueueManager = new OfflineQueueManager();
