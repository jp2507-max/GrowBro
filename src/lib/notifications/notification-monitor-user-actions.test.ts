/**
 * @jest-environment node
 */

import {
  clearLatencyRecords,
  getLatencyRecords,
  initLatencyRecord,
  recordDeliveredToDevice,
  recordDismissedByUser,
  recordOpenedByUser,
  recordSentToExpo,
} from './notification-monitor';

describe('NotificationMonitor - User Actions', () => {
  beforeEach(() => {
    clearLatencyRecords();
  });

  describe('recordOpenedByUser', () => {
    it('should record when user opened notification', () => {
      initLatencyRecord('msg_123', 'community.reply', 'ios');
      recordSentToExpo('msg_123');
      recordDeliveredToDevice('msg_123');
      const beforeOpened = Date.now();
      recordOpenedByUser('msg_123');

      const records = getLatencyRecords();
      expect(records[0].openedByUserAt).toBeGreaterThanOrEqual(beforeOpened);
    });
  });

  describe('recordDismissedByUser', () => {
    it('should record dismissal for Android notifications', () => {
      initLatencyRecord('msg_123', 'community.reply', 'android');
      const beforeDismissed = Date.now();
      recordDismissedByUser('msg_123');

      const records = getLatencyRecords();
      expect(records[0].dismissedByUserAt).toBeGreaterThanOrEqual(
        beforeDismissed
      );
    });

    it('should not record dismissal for iOS notifications', () => {
      initLatencyRecord('msg_123', 'community.reply', 'ios');
      recordDismissedByUser('msg_123');

      const records = getLatencyRecords();
      expect(records[0].dismissedByUserAt).toBeUndefined();
    });
  });
});
