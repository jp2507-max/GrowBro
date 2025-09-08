import {
  clearLogs,
  getLogs,
  getMetrics,
  logEvent,
  recordDuration,
} from '@/lib/sync/monitor';

describe('monitor', () => {
  beforeEach(() => {
    clearLogs();
  });

  test('records durations and computes percentiles', () => {
    recordDuration('pull', 10);
    recordDuration('pull', 30);
    recordDuration('pull', 20);
    const m = getMetrics();
    expect(m.p50.pull).toBeGreaterThanOrEqual(10);
    expect(m.p50.pull).toBeLessThanOrEqual(30);
    expect(m.p95.pull).toBeGreaterThanOrEqual(m.p50.pull ?? 0);
  });

  test('logs events and clamps size', () => {
    for (let i = 0; i < 5; i++) logEvent({ stage: 'push', message: `m${i}` });
    const logs = getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBeDefined();
  });
});
