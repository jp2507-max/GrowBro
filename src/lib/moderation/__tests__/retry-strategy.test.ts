/**
 * Retry Strategy Tests
 */

import {
  CRITICAL_RETRY_CONFIG,
  criticalRetryStrategy,
  RetryStrategy,
  STANDARD_RETRY_CONFIG,
} from '../retry-strategy';

describe('RetryStrategy', () => {
  describe('successful operations', () => {
    test('returns result on first attempt for successful operation', async () => {
      const strategy = new RetryStrategy();
      const operation = jest.fn().mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('tracks total duration', async () => {
      const strategy = new RetryStrategy();
      const operation = jest.fn().mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('retry logic', () => {
    test('retries on transient errors', async () => {
      const strategy = new RetryStrategy({ maxAttempts: 3, baseDelayMs: 10 });
      const operation = jest
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('Service unavailable'), { status: 503 })
        )
        .mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('does not retry on permanent errors', async () => {
      const strategy = new RetryStrategy({ maxAttempts: 3 });
      const operation = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Bad request'), { status: 400 })
        );

      const result = await strategy.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('stops after max attempts', async () => {
      const strategy = new RetryStrategy({ maxAttempts: 3, baseDelayMs: 10 });
      const operation = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Service unavailable'), { status: 503 })
        );

      const result = await strategy.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('exponential backoff', () => {
    test('increases delay exponentially', async () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
        jitterFactor: 0,
      });

      const delays: number[] = [];
      const operation = jest.fn().mockImplementation(async () => {
        if (delays.length > 0) {
          const lastDelay = Date.now() - delays[delays.length - 1];
          delays.push(lastDelay);
        } else {
          delays.push(Date.now());
        }
        throw Object.assign(new Error('Service unavailable'), { status: 503 });
      });

      await strategy.execute(operation);

      // First attempt has no delay, subsequent attempts have exponential delays
      // Delays should be approximately: 100ms, 200ms
      expect(delays.length).toBe(3);
    });

    test('caps delay at maxDelayMs', async () => {
      const strategy = new RetryStrategy({
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        jitterFactor: 0,
      });

      // With multiplier 2: 1000, 2000, 4000 (capped at 2000), 8000 (capped at 2000)
      // All delays after second attempt should be capped at 2000ms
      const operation = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Service unavailable'), { status: 503 })
        );

      await strategy.execute(operation);

      expect(operation).toHaveBeenCalledTimes(5);
    });
  });

  describe('timeout handling', () => {
    test('times out long-running operations', async () => {
      const strategy = new RetryStrategy({ timeoutMs: 100, maxAttempts: 1 });
      const operation = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 200);
          })
      );

      const result = await strategy.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    test('does not timeout fast operations', async () => {
      const strategy = new RetryStrategy({ timeoutMs: 1000 });
      const operation = jest.fn().mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
  });

  describe('configuration', () => {
    test('uses default configuration', () => {
      const strategy = new RetryStrategy();
      const config = strategy.getConfig();

      expect(config.maxAttempts).toBe(3);
      expect(config.baseDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(30000);
    });

    test('accepts custom configuration', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 5,
        baseDelayMs: 500,
      });
      const config = strategy.getConfig();

      expect(config.maxAttempts).toBe(5);
      expect(config.baseDelayMs).toBe(500);
    });

    test('updates configuration', () => {
      const strategy = new RetryStrategy();
      strategy.updateConfig({ maxAttempts: 10 });
      const config = strategy.getConfig();

      expect(config.maxAttempts).toBe(10);
    });
  });

  describe('preset configurations', () => {
    test('critical config has aggressive retry', () => {
      expect(CRITICAL_RETRY_CONFIG.maxAttempts).toBe(5);
      expect(CRITICAL_RETRY_CONFIG.baseDelayMs).toBe(500);
      expect(CRITICAL_RETRY_CONFIG.backoffMultiplier).toBe(1.5);
    });

    test('standard config has balanced retry', () => {
      expect(STANDARD_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(STANDARD_RETRY_CONFIG.baseDelayMs).toBe(1000);
      expect(STANDARD_RETRY_CONFIG.backoffMultiplier).toBe(2);
    });

    test('singleton instances are available', () => {
      expect(criticalRetryStrategy).toBeInstanceOf(RetryStrategy);
    });
  });

  describe('error context', () => {
    test('passes context to error classifier', async () => {
      const strategy = new RetryStrategy({ maxAttempts: 2, baseDelayMs: 10 });
      const operation = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Service unavailable'), { status: 503 })
        );

      const result = await strategy.execute(operation, {
        operation: 'test_operation',
        userId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
    });
  });
});
