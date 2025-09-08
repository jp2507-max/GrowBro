import { computeBackoffMs } from '@/lib/sync/backoff';

describe('runSyncWithRetry helpers', () => {
  test('computeBackoffMs caps at ≤ 15 minutes', () => {
    const cap = 900_000;
    const v0 = computeBackoffMs(0, 1000, cap);
    const v4 = computeBackoffMs(4, 1000, cap);
    const v8 = computeBackoffMs(8, 1000, cap);
    expect(v0).toBeGreaterThanOrEqual(1000);
    expect(v4).toBeLessThanOrEqual(cap + 1000);
    expect(v8).toBeLessThanOrEqual(cap + 1000);
  });
});
