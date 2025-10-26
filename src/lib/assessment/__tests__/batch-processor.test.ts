import type { AssessmentRequestModel } from '@/lib/watermelon-models/assessment-request';

import { BatchProcessor } from '../batch-processor';

// Mock AssessmentRequestModel
const createMockRequest = (id: string): AssessmentRequestModel =>
  ({
    id,
    plantId: 'plant-1',
    userId: 'user-1',
    status: 'pending' as const,
    photos: [],
    plantContext: { id: 'plant-1' },
    retryCount: 0,
    originalTimestamp: Date.now(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isPending: true,
    isProcessing: false,
    isCompleted: false,
    hasFailed: false,
    shouldRetry: true,
    hasExceededMaxRetries: false,
  }) as unknown as AssessmentRequestModel;

describe('BatchProcessor', () => {
  describe('processBatch', () => {
    test('processes requests in batches', async () => {
      const processor = new BatchProcessor({
        maxBatchSize: 2,
        maxConcurrent: 1,
        processingDelayMs: 10,
      });

      const requests = [
        createMockRequest('req-1'),
        createMockRequest('req-2'),
        createMockRequest('req-3'),
        createMockRequest('req-4'),
      ];

      const processedIds: string[] = [];
      const processFn = jest.fn(async (req) => {
        processedIds.push(req.id);
        return {
          requestId: req.id,
          success: true,
          processedAt: Date.now(),
        };
      });

      const results = await processor.processBatch(requests, processFn);

      expect(results).toHaveLength(4);
      expect(processedIds).toEqual(['req-1', 'req-2', 'req-3', 'req-4']);
      expect(processFn).toHaveBeenCalledTimes(4);
    });

    test('respects concurrency limit', async () => {
      const processor = new BatchProcessor({
        maxBatchSize: 10,
        maxConcurrent: 2,
        processingDelayMs: 0,
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        createMockRequest(`req-${i}`)
      );

      let concurrentCount = 0;
      let maxConcurrent = 0;

      const processFn = jest.fn(async (req) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        await new Promise((resolve) => setTimeout(resolve, 50));

        concurrentCount--;
        return {
          requestId: req.id,
          success: true,
          processedAt: Date.now(),
        };
      });

      await processor.processBatch(requests, processFn);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    test('handles processing errors gracefully', async () => {
      const processor = new BatchProcessor({
        maxBatchSize: 5,
        maxConcurrent: 2,
      });

      const requests = [
        createMockRequest('req-1'),
        createMockRequest('req-2'),
        createMockRequest('req-3'),
      ];

      const processFn = jest.fn(async (req) => {
        if (req.id === 'req-2') {
          throw new Error('Processing failed');
        }
        return {
          requestId: req.id,
          success: true,
          processedAt: Date.now(),
        };
      });

      const results = await processor.processBatch(requests, processFn);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Processing failed');
      expect(results[2].success).toBe(true);
    });

    test('adjusts batch size for metered connections', async () => {
      const processor = new BatchProcessor({
        maxBatchSize: 10,
        maxConcurrent: 5,
        respectMeteredConnection: true,
      });

      const requests = Array.from({ length: 10 }, (_, i) =>
        createMockRequest(`req-${i}`)
      );

      const processFn = jest.fn(async (req) => ({
        requestId: req.id,
        success: true,
        processedAt: Date.now(),
      }));

      await processor.processBatch(requests, processFn, { isMetered: true });

      // Should process in smaller batches for metered connection
      expect(processFn).toHaveBeenCalledTimes(10);
    });

    test('processes empty array without errors', async () => {
      const processor = new BatchProcessor();
      const processFn = jest.fn();

      const results = await processor.processBatch([], processFn);

      expect(results).toEqual([]);
      expect(processFn).not.toHaveBeenCalled();
    });

    test('adds delay between batches', async () => {
      const processor = new BatchProcessor({
        maxBatchSize: 2,
        maxConcurrent: 1,
        processingDelayMs: 100,
      });

      const requests = Array.from({ length: 4 }, (_, i) =>
        createMockRequest(`req-${i}`)
      );

      const startTime = Date.now();
      const processFn = jest.fn(async (req) => ({
        requestId: req.id,
        success: true,
        processedAt: Date.now(),
      }));

      await processor.processBatch(requests, processFn);

      const duration = Date.now() - startTime;

      // Should have at least one delay between batches (100ms)
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('estimateProcessingTime', () => {
    test('estimates processing time correctly', () => {
      const processor = new BatchProcessor({
        maxBatchSize: 5,
        maxConcurrent: 2,
        processingDelayMs: 500,
      });

      const estimate = processor.estimateProcessingTime(10, false);

      // 10 requests, batch size 5 = 2 batches
      // Each batch: (5 requests / 2 concurrent) * 5000ms = 12500ms
      // Plus 1 delay between batches: 500ms
      // Total: ~25500ms
      expect(estimate).toBeGreaterThan(20000);
      expect(estimate).toBeLessThan(30000);
    });

    test('adjusts estimate for metered connections', () => {
      const processor = new BatchProcessor({
        maxBatchSize: 10,
        maxConcurrent: 5,
        respectMeteredConnection: true,
      });

      const normalEstimate = processor.estimateProcessingTime(10, false);
      const meteredEstimate = processor.estimateProcessingTime(10, true);

      // Metered should take longer due to smaller batches and lower concurrency
      expect(meteredEstimate).toBeGreaterThan(normalEstimate);
    });

    test('handles zero requests', () => {
      const processor = new BatchProcessor();
      const estimate = processor.estimateProcessingTime(0, false);

      expect(estimate).toBe(0);
    });
  });
});
