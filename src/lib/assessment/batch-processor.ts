import type { AssessmentRequestModel } from '@/lib/watermelon-models/assessment-request';
import type { ProcessingResult } from '@/types/assessment';

/**
 * Batch processor for assessment requests
 * Handles efficient batch processing with rate limiting and resource management
 */

export type BatchProcessorConfig = {
  maxBatchSize?: number;
  maxConcurrent?: number;
  processingDelayMs?: number;
  respectMeteredConnection?: boolean;
};

export type ProcessRequestFn = (
  request: AssessmentRequestModel
) => Promise<ProcessingResult>;

const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_PROCESSING_DELAY_MS = 500;

export class BatchProcessor {
  private readonly maxBatchSize: number;
  private readonly maxConcurrent: number;
  private readonly processingDelayMs: number;
  private readonly respectMeteredConnection: boolean;

  constructor(config: BatchProcessorConfig = {}) {
    this.maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxConcurrent = config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.processingDelayMs =
      config.processingDelayMs ?? DEFAULT_PROCESSING_DELAY_MS;
    this.respectMeteredConnection = config.respectMeteredConnection ?? true;
  }

  /**
   * Process requests in batches with concurrency control
   */
  async processBatch(
    requests: AssessmentRequestModel[],
    processFn: ProcessRequestFn,
    options: { isMetered?: boolean } = {}
  ): Promise<ProcessingResult[]> {
    const { isMetered = false } = options;

    // Adjust batch size for metered connections
    const effectiveBatchSize =
      this.respectMeteredConnection && isMetered
        ? Math.min(this.maxBatchSize, 3)
        : this.maxBatchSize;

    const effectiveConcurrent =
      this.respectMeteredConnection && isMetered
        ? Math.min(this.maxConcurrent, 1)
        : this.maxConcurrent;

    const results: ProcessingResult[] = [];
    const batches = this.createBatches(requests, effectiveBatchSize);

    for (const batch of batches) {
      const batchResults = await this.processConcurrent(
        batch,
        processFn,
        effectiveConcurrent
      );
      results.push(...batchResults);

      // Add delay between batches to avoid overwhelming the server
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(this.processingDelayMs);
      }
    }

    return results;
  }

  /**
   * Process requests with controlled concurrency
   */
  private async processConcurrent(
    requests: AssessmentRequestModel[],
    processFn: ProcessRequestFn,
    maxConcurrent: number
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const executing: Promise<void>[] = [];

    for (const request of requests) {
      const promise = processFn(request)
        .then((result) => {
          results.push(result);
        })
        .catch((error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          results.push({
            requestId: request.id,
            success: false,
            error: errorMessage,
            processedAt: Date.now(),
          });
        })
        .finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });

      executing.push(promise);

      // Wait if we've reached max concurrency
      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining promises
    await Promise.all(executing);

    return results;
  }

  /**
   * Split requests into batches
   */
  private createBatches(
    requests: AssessmentRequestModel[],
    batchSize: number
  ): AssessmentRequestModel[][] {
    const batches: AssessmentRequestModel[][] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Estimate processing time for a batch
   */
  estimateProcessingTime(requestCount: number, isMetered: boolean): number {
    const effectiveBatchSize =
      this.respectMeteredConnection && isMetered
        ? Math.min(this.maxBatchSize, 3)
        : this.maxBatchSize;

    const effectiveConcurrent =
      this.respectMeteredConnection && isMetered
        ? Math.min(this.maxConcurrent, 1)
        : this.maxConcurrent;

    const batchCount = Math.ceil(requestCount / effectiveBatchSize);
    const avgProcessingTimePerRequest = 5000; // 5s average per request
    const timePerBatch =
      (effectiveBatchSize / effectiveConcurrent) * avgProcessingTimePerRequest;
    const totalTime = batchCount * (timePerBatch + this.processingDelayMs);

    return totalTime;
  }
}

// Singleton instance
export const batchProcessor = new BatchProcessor();
