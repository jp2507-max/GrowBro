/**
 * Exponential Backoff Tests
 */

import {
  calculateBackoffDelay,
  retryWithBackoff,
  sleep,
} from '../exponential-backoff';

describe('calculateBackoffDelay', () => {
  it('calculates exponential delay correctly', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0 };

    expect(calculateBackoffDelay(0, config)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoffDelay(1, config)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoffDelay(2, config)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoffDelay(3, config)).toBe(8000); // 1000 * 2^3
  });

  it('caps delay at maxDelayMs', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 5000, jitterFactor: 0 };

    expect(calculateBackoffDelay(10, config)).toBe(5000);
    expect(calculateBackoffDelay(20, config)).toBe(5000);
  });

  it('applies jitter factor', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.1 };

    const delay1 = calculateBackoffDelay(0, config);
    const delay2 = calculateBackoffDelay(0, config);

    // Delays should be different due to randomness
    // Both should be within ±10% of 1000
    expect(delay1).toBeGreaterThanOrEqual(900);
    expect(delay1).toBeLessThanOrEqual(1100);
    expect(delay2).toBeGreaterThanOrEqual(900);
    expect(delay2).toBeLessThanOrEqual(1100);
  });

  it('never returns negative delay', () => {
    const config = { baseDelayMs: 10, maxDelayMs: 50, jitterFactor: 1.0 };

    for (let i = 0; i < 10; i++) {
      const delay = calculateBackoffDelay(i, config);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('sleep', () => {
  it('resolves after specified time', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(200);
  });
});

describe('retryWithBackoff', () => {
  it('succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const config = { baseDelayMs: 100, maxDelayMs: 1000, maxRetries: 3 };

    const result = await retryWithBackoff(fn, config);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const config = { baseDelayMs: 10, maxDelayMs: 100, maxRetries: 3 };
    const onRetry = jest.fn();

    const result = await retryWithBackoff(fn, config, onRetry);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
    const config = { baseDelayMs: 10, maxDelayMs: 100, maxRetries: 2 };

    await expect(retryWithBackoff(fn, config)).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('calls onRetry callback with attempt number', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));
    const config = { baseDelayMs: 10, maxDelayMs: 100, maxRetries: 2 };
    const onRetry = jest.fn();

    await expect(retryWithBackoff(fn, config, onRetry)).rejects.toThrow();

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
  });

  it('waits between retries', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');

    const config = { baseDelayMs: 50, maxDelayMs: 1000, maxRetries: 2 };

    const start = Date.now();
    await retryWithBackoff(fn, config);
    const elapsed = Date.now() - start;

    // Should wait at least baseDelayMs between attempts
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
