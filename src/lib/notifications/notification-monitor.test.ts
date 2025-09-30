/**
 * @jest-environment node
 */

import {
  clearLatencyRecords,
  getLatencyRecords,
  initLatencyRecord,
  recordDeliveredToDevice,
  recordSentToExpo,
} from './notification-monitor';

describe('NotificationMonitor - Record Management', () => {
  beforeEach(() => {
    clearLatencyRecords();
  });

  describe('initLatencyRecord', () => {
    it('should create a new latency record with request timestamp', () => {
      const now = Date.now();
      initLatencyRecord('msg_123', 'community.reply', 'ios');

      const records = getLatencyRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        messageId: 'msg_123',
        type: 'community.reply',
        platform: 'ios',
      });
      expect(records[0].requestCreatedAt).toBeGreaterThanOrEqual(now);
    });

    it('should maintain only last 500 records', () => {
      for (let i = 0; i < 600; i++) {
        initLatencyRecord(`msg_${i}`, 'community.like', 'android');
      }

      const records = getLatencyRecords();
      expect(records).toHaveLength(500);
      expect(records[499].messageId).toBe('msg_599');
    });
  });

  describe('recordSentToExpo', () => {
    it('should record when notification was sent to Expo', () => {
      initLatencyRecord('msg_123', 'community.reply', 'ios');
      const beforeSent = Date.now();
      recordSentToExpo('msg_123');

      const records = getLatencyRecords();
      expect(records[0].sentToExpoAt).toBeGreaterThanOrEqual(beforeSent);
    });

    it('should do nothing for non-existent message ID', () => {
      recordSentToExpo('msg_nonexistent');
      expect(getLatencyRecords()).toHaveLength(0);
    });
  });

  describe('recordDeliveredToDevice', () => {
    it('should record when notification was delivered', () => {
      initLatencyRecord('msg_123', 'community.reply', 'ios');
      recordSentToExpo('msg_123');
      const beforeDelivered = Date.now();
      recordDeliveredToDevice('msg_123');

      const records = getLatencyRecords();
      expect(records[0].deliveredToDeviceAt).toBeGreaterThanOrEqual(
        beforeDelivered
      );
    });
  });
});
