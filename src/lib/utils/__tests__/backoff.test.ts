import {
  calculateBackoffDelay,
  calculateBackoffDelayWithJitter,
} from '../backoff';

describe('calculateBackoffDelay', () => {
  test('calculates exponential backoff correctly', () => {
    expect(calculateBackoffDelay(0)).toBe(1000); // 1s
    expect(calculateBackoffDelay(1)).toBe(2000); // 2s
    expect(calculateBackoffDelay(2)).toBe(4000); // 4s
    expect(calculateBackoffDelay(3)).toBe(8000); // 8s
    expect(calculateBackoffDelay(4)).toBe(16000); // 16s
    expect(calculateBackoffDelay(5)).toBe(32000); // 32s (max)
  });

  test('respects max delay', () => {
    expect(calculateBackoffDelay(10)).toBe(32000); // capped at max
    expect(calculateBackoffDelay(100)).toBe(32000); // capped at max
  });

  test('allows custom base and max delays', () => {
    expect(calculateBackoffDelay(0, 500, 10000)).toBe(500);
    expect(calculateBackoffDelay(1, 500, 10000)).toBe(1000);
    expect(calculateBackoffDelay(5, 500, 10000)).toBe(10000); // capped
  });
});

describe('calculateBackoffDelayWithJitter', () => {
  test('returns delay within expected range', () => {
    const retryCount = 2;
    const baseDelay = 2000;
    const maxDelay = 60000;
    const jitterFactor = 0.2;

    // Expected base: 2000 * 2^2 = 8000ms
    // With ±20% jitter: 6400-9600ms
    const delay = calculateBackoffDelayWithJitter(retryCount, {
      baseDelayMs: baseDelay,
      maxDelayMs: maxDelay,
      jitterFactor,
    });

    expect(delay).toBeGreaterThanOrEqual(6400);
    expect(delay).toBeLessThanOrEqual(9600);
  });

  test('uses default values correctly', () => {
    const delay = calculateBackoffDelayWithJitter(0);

    // Default base: 2000ms, jitter: ±20%
    // Range: 1600-2400ms
    expect(delay).toBeGreaterThanOrEqual(1600);
    expect(delay).toBeLessThanOrEqual(2400);
  });

  test('respects max delay with jitter', () => {
    const delay = calculateBackoffDelayWithJitter(10, {
      baseDelayMs: 2000,
      maxDelayMs: 60000,
    });

    // Should never exceed max delay
    expect(delay).toBeLessThanOrEqual(60000);
  });

  test('produces different values due to jitter', () => {
    const delays = Array.from({ length: 10 }, () =>
      calculateBackoffDelayWithJitter(2)
    );

    // Should have at least some variation
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });

  test('never returns negative delay', () => {
    const delay = calculateBackoffDelayWithJitter(0, {
      baseDelayMs: 100,
      jitterFactor: 0.9,
    });

    expect(delay).toBeGreaterThanOrEqual(0);
  });

  test('handles zero retry count', () => {
    const delay = calculateBackoffDelayWithJitter(0, {
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      jitterFactor: 0.2,
    });

    // Base: 2000ms, jitter: ±20%
    expect(delay).toBeGreaterThanOrEqual(1600);
    expect(delay).toBeLessThanOrEqual(2400);
  });

  test('handles large retry counts', () => {
    const delay = calculateBackoffDelayWithJitter(100, {
      baseDelayMs: 2000,
      maxDelayMs: 60000,
    });

    // Should be capped at max delay
    expect(delay).toBeLessThanOrEqual(60000);
  });
});
