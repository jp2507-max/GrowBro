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
    const baseDelay = 1000;
    const maxDelay = 32000;
    const jitterFactor = 0.2;

    // Expected base: 1000 * 2^2 = 4000ms
    // With ±20% jitter: 3200-4800ms
    const delay = calculateBackoffDelayWithJitter(retryCount, {
      baseDelayMs: baseDelay,
      maxDelayMs: maxDelay,
      jitterFactor,
    });

    expect(delay).toBeGreaterThanOrEqual(3200);
    expect(delay).toBeLessThanOrEqual(4800);
  });

  test('uses default values correctly', () => {
    const delay = calculateBackoffDelayWithJitter(0);

    // Default base: 1000ms, jitter: ±20%
    // Range: 800-1200ms
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);
  });

  test('respects max delay with jitter', () => {
    const delay = calculateBackoffDelayWithJitter(10, {
      baseDelayMs: 1000,
      maxDelayMs: 32000,
    });

    // Should never exceed max delay
    expect(delay).toBeLessThanOrEqual(32000);
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
      baseDelayMs: 1000,
      maxDelayMs: 32000,
      jitterFactor: 0.2,
    });

    // Base: 1000ms, jitter: ±20%
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);
  });

  test('handles large retry counts', () => {
    const delay = calculateBackoffDelayWithJitter(100, {
      baseDelayMs: 1000,
      maxDelayMs: 32000,
    });

    // Should be capped at max delay
    expect(delay).toBeLessThanOrEqual(32000);
  });

  test('guards against negative retry count', () => {
    const delay = calculateBackoffDelayWithJitter(-1);
    expect(delay).toBeGreaterThanOrEqual(800); // same as retry count 0
    expect(delay).toBeLessThanOrEqual(1200);
  });

  test('guards against invalid retry count', () => {
    const delay = calculateBackoffDelayWithJitter(NaN);
    expect(delay).toBeGreaterThanOrEqual(800); // same as retry count 0
    expect(delay).toBeLessThanOrEqual(1200);
  });

  test('returns integer delays (no fractions)', () => {
    const delays = Array.from({ length: 10 }, () =>
      calculateBackoffDelayWithJitter(2)
    );

    delays.forEach((delay) => {
      expect(Number.isInteger(delay)).toBe(true);
    });
  });

  describe('jitter bounds', () => {
    test('returns lowest bound when Math.random returns 0', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0); // lowest bound
      const delay = calculateBackoffDelayWithJitter(2); // 1000 * 2^2 = 4000ms
      expect(delay).toBe(3200); // 4000 * 0.8 = 3200
      (Math.random as jest.Mock).mockRestore();
    });

    test('returns highest bound when Math.random returns 1', () => {
      jest.spyOn(Math, 'random').mockReturnValue(1); // highest bound
      const delay = calculateBackoffDelayWithJitter(2); // 1000 * 2^2 = 4000ms
      expect(delay).toBe(4800); // 4000 * 1.2 = 4800
      (Math.random as jest.Mock).mockRestore();
    });
  });
});
