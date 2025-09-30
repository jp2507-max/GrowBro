/**
 * @jest-environment node
 */

import {
  clearLatencyRecords,
  getLatencyRecords,
  getNotificationMetrics,
  initLatencyRecord,
} from './notification-monitor';

describe('NotificationMonitor - Metrics Calculation', () => {
  beforeEach(() => {
    clearLatencyRecords();
  });

  it('should calculate latency metrics for complete flow', () => {
    const startTime = Date.now();
    initLatencyRecord('msg_123', 'community.reply', 'ios');

    const records = getLatencyRecords();
    records[0].requestCreatedAt = startTime;
    records[0].sentToExpoAt = startTime + 100;
    records[0].deliveredToDeviceAt = startTime + 500;
    records[0].openedByUserAt = startTime + 2000;

    const metrics = getNotificationMetrics();

    expect(metrics.latency.requestToSent.p50).toBe(100);
    expect(metrics.latency.sentToDelivered.p50).toBe(400);
    expect(metrics.latency.deliveredToOpened.p50).toBe(1500);
    expect(metrics.latency.endToEnd.p50).toBe(2000);
  });

  it('should detect target violations for community notifications', () => {
    const startTime = Date.now();

    initLatencyRecord('msg_fast', 'community.reply', 'ios');
    const fast = getLatencyRecords()[0];
    fast.requestCreatedAt = startTime;
    fast.openedByUserAt = startTime + 3000;

    initLatencyRecord('msg_slow', 'community.like', 'android');
    const slow = getLatencyRecords()[1];
    slow.requestCreatedAt = startTime;
    slow.openedByUserAt = startTime + 8000;

    const metrics = getNotificationMetrics();

    expect(metrics.current.targetViolations).toBe(1);
    expect(metrics.alerts.slowDeliveries).toBe(1);
  });
});

describe('NotificationMonitor - Delivery Rate Metrics', () => {
  beforeEach(() => {
    clearLatencyRecords();
  });

  it('should calculate delivery rate correctly', () => {
    const startTime = Date.now();

    for (let i = 0; i < 5; i++) {
      initLatencyRecord(`msg_${i}`, 'community.reply', 'ios');
      const record = getLatencyRecords()[i];
      record.requestCreatedAt = startTime;

      if (i < 4) {
        record.openedByUserAt = startTime + 2000;
      }
    }

    const metrics = getNotificationMetrics();

    expect(metrics.current.deliveryRatePercent).toBe(80.0);
    expect(metrics.alerts.belowThreshold).toBe(true);
  });

  it('should return null metrics when no data available', () => {
    const metrics = getNotificationMetrics();

    expect(metrics.latency.requestToSent.p50).toBeNull();
    expect(metrics.latency.endToEnd.p95).toBeNull();
    expect(metrics.current.avgEndToEndLatency).toBeNull();
    expect(metrics.current.deliveryRatePercent).toBeNull();
    expect(metrics.current.targetViolations).toBe(0);
  });
});
