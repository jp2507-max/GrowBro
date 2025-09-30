/**
 * @jest-environment node
 */

import {
  clearLatencyRecords,
  getLatencyRecords,
  getNotificationMetrics,
  initLatencyRecord,
} from './notification-monitor';

describe('NotificationMonitor - Percentile Calculations', () => {
  beforeEach(() => {
    clearLatencyRecords();
  });

  it('should calculate p50 and p95 percentiles correctly', () => {
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      initLatencyRecord(`msg_${i}`, 'community.reply', 'ios');
      const record = getLatencyRecords()[i];
      record.requestCreatedAt = startTime;
      record.openedByUserAt = startTime + (i + 1) * 1000;
    }

    const metrics = getNotificationMetrics();

    expect(metrics.latency.endToEnd.p50).toBeGreaterThanOrEqual(4000);
    expect(metrics.latency.endToEnd.p50).toBeLessThanOrEqual(6000);

    expect(metrics.latency.endToEnd.p95).toBeGreaterThanOrEqual(9000);
    expect(metrics.latency.endToEnd.p95).toBeLessThanOrEqual(10000);
  });

  it('should filter out unreasonable latencies', () => {
    const startTime = Date.now();

    initLatencyRecord('msg_normal', 'community.reply', 'ios');
    const normal = getLatencyRecords()[0];
    normal.requestCreatedAt = startTime;
    normal.openedByUserAt = startTime + 3000;

    initLatencyRecord('msg_unreasonable', 'community.like', 'android');
    const unreasonable = getLatencyRecords()[1];
    unreasonable.requestCreatedAt = startTime;
    unreasonable.openedByUserAt = startTime + 120000;

    const metrics = getNotificationMetrics();

    expect(metrics.latency.endToEnd.p50).toBe(3000);
    expect(metrics.current.avgEndToEndLatency).toBe(3000);
  });
});
