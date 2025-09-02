/* eslint-disable max-lines-per-function */
/**
 * Unit tests for date utility functions
 */

import { DateTime } from 'luxon';

import { combineTargetDateWithTime } from './date';

describe('combineTargetDateWithTime', () => {
  describe('basic functionality', () => {
    it('should preserve time components when combining dates in the same timezone', () => {
      const originalDate = new Date('2024-03-15T14:30:45.123Z'); // 2:30:45 PM UTC
      const targetDate = new Date('2024-03-20'); // March 20th
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // In America/New_York timezone, the original UTC time converts to 10:30:45 AM EDT
      // When combined with March 20th, we should get March 20th at 10:30:45 AM EDT
      expect(result.localDateTime.hour).toBe(10);
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.second).toBe(45);
      expect(result.localDateTime.millisecond).toBe(123);
      expect(result.localDateTime.day).toBe(20);
      expect(result.localDateTime.month).toBe(3);
      expect(result.localDateTime.year).toBe(2024);
    });

    it('should handle UTC timezone correctly', () => {
      const originalDate = new Date('2024-03-15T14:30:45.123Z'); // 2:30:45 PM UTC
      const targetDate = new Date('2024-03-20'); // March 20th
      const timezone = 'UTC';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // In UTC timezone, original time should be preserved exactly
      expect(result.localDateTime.hour).toBe(14);
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.second).toBe(45);
      expect(result.localDateTime.millisecond).toBe(123);
      expect(result.localDateTime.day).toBe(20);
      expect(result.localDateTime.month).toBe(3);
      expect(result.localDateTime.year).toBe(2024);

      // UTC date should match the local datetime converted to UTC
      expect(result.utcDate.getTime()).toBe(result.utcDateTime.toMillis());
    });
  });

  describe('DST transitions', () => {
    // In US Eastern Time, DST starts on March 10, 2024 at 2:00 AM
    // Time jumps from 2:00 AM EST to 3:00 AM EDT

    it('should preserve local time when moving from before DST to after DST (spring forward)', () => {
      // Original time: March 9, 2024 at 2:30 AM EST (before DST transition)
      const originalDate = new Date('2024-03-09T07:30:00.000Z'); // 2:30 AM EST = 7:30 AM UTC
      const targetDate = new Date('2024-03-15'); // March 15th (after DST transition)
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // Should result in March 15th at 2:30 AM EDT (preserving the local time)
      // EDT is UTC-4, so 2:30 AM EDT = 6:30 AM UTC
      expect(result.localDateTime.hour).toBe(2); // Local hour preserved
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.day).toBe(15);
      expect(result.localDateTime.month).toBe(3);
      expect(result.localDateTime.year).toBe(2024);

      // UTC offset should be -4 hours (EDT)
      expect(result.localDateTime.offset).toBe(-240); // -240 minutes = -4 hours

      // UTC time should be 6:30 AM UTC (2:30 AM EDT is 6:30 AM UTC)
      expect(result.utcDateTime.hour).toBe(6);
      expect(result.utcDateTime.minute).toBe(30);
    });

    it('should preserve local time when moving from after DST to before DST (fall back)', () => {
      // Original time: March 15, 2024 at 2:30 AM EDT (after DST transition)
      const originalDate = new Date('2024-03-15T06:30:00.000Z'); // 2:30 AM EDT = 6:30 AM UTC
      const targetDate = new Date('2024-03-05'); // March 5th (before DST transition)
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // Should result in March 5th at 2:30 AM EST (preserving the local time)
      // EST is UTC-5, so 2:30 AM EST = 7:30 AM UTC
      expect(result.localDateTime.hour).toBe(2); // Local hour preserved
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.day).toBe(5);
      expect(result.localDateTime.month).toBe(3);
      expect(result.localDateTime.year).toBe(2024);

      // UTC offset should be -5 hours (EST)
      expect(result.localDateTime.offset).toBe(-300); // -300 minutes = -5 hours

      // UTC time should be 7:30 AM UTC (2:30 AM EST is 7:30 AM UTC)
      expect(result.utcDateTime.hour).toBe(7);
      expect(result.utcDateTime.minute).toBe(30);
    });

    it('should handle the ambiguous hour during fall back (November DST transition)', () => {
      // In US Eastern Time, DST ends on November 3, 2024 at 2:00 AM
      // Time falls back from 2:00 AM EDT to 1:00 AM EST, creating an ambiguous hour

      // Original time: November 3, 2024 at 1:30 AM EDT (during the ambiguous hour)
      // This could be interpreted as either EDT or EST, but we'll preserve the original time
      const originalDate = new Date('2024-11-03T05:30:00.000Z'); // 1:30 AM EDT = 5:30 AM UTC
      const targetDate = new Date('2024-11-10'); // November 10th
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // Should result in November 10th at 1:30 AM EST (after DST fall back)
      expect(result.localDateTime.hour).toBe(1); // Local hour preserved
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.day).toBe(10);
      expect(result.localDateTime.month).toBe(11);
      expect(result.localDateTime.year).toBe(2024);

      // UTC offset should be -5 hours (EST, after DST fall back)
      expect(result.localDateTime.offset).toBe(-300); // -300 minutes = -5 hours

      // UTC time should be 6:30 AM UTC (1:30 AM EST is 6:30 AM UTC)
      expect(result.utcDateTime.hour).toBe(6);
      expect(result.utcDateTime.minute).toBe(30);
    });

    it('should handle European DST transitions correctly', () => {
      // European DST starts on March 31, 2024 at 2:00 AM
      // Time jumps from 2:00 AM CET to 3:00 AM CEST

      // Original time: March 30, 2024 at 2:30 AM CET (before DST transition)
      const originalDate = new Date('2024-03-30T01:30:00.000Z'); // 2:30 AM CET = 1:30 AM UTC
      const targetDate = new Date('2024-04-05'); // April 5th (after DST transition)
      const timezone = 'Europe/London';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      // Should result in April 5th at 1:30 AM BST (British Summer Time, equivalent to CEST)
      expect(result.localDateTime.hour).toBe(1); // Local hour preserved (actually 1:30 AM BST)
      expect(result.localDateTime.minute).toBe(30);
      expect(result.localDateTime.day).toBe(5);
      expect(result.localDateTime.month).toBe(4);
      expect(result.localDateTime.year).toBe(2024);

      // UTC offset should be +1 hour (BST)
      expect(result.localDateTime.offset).toBe(60); // +60 minutes = +1 hour

      // UTC time should be 0:30 AM UTC (1:30 AM BST is 0:30 AM UTC)
      expect(result.utcDateTime.hour).toBe(0);
      expect(result.utcDateTime.minute).toBe(30);
    });

    it('should preserve exact time components including milliseconds', () => {
      const originalDate = new Date('2024-03-15T14:30:45.123Z');
      const targetDate = new Date('2024-03-20');
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      expect(result.localDateTime.second).toBe(45);
      expect(result.localDateTime.millisecond).toBe(123);
      expect(result.utcDateTime.second).toBe(45);
      expect(result.utcDateTime.millisecond).toBe(123);
    });

    it('should return valid DateTime objects', () => {
      const originalDate = new Date('2024-03-15T14:30:45.123Z');
      const targetDate = new Date('2024-03-20');
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      expect(result.localDateTime).toBeInstanceOf(DateTime);
      expect(result.utcDateTime).toBeInstanceOf(DateTime);
      expect(result.utcDate).toBeInstanceOf(Date);
      expect(result.localDateTime.isValid).toBe(true);
      expect(result.utcDateTime.isValid).toBe(true);
    });

    it('should maintain consistency between utcDate and utcDateTime', () => {
      const originalDate = new Date('2024-03-15T14:30:45.123Z');
      const targetDate = new Date('2024-03-20');
      const timezone = 'America/New_York';

      const result = combineTargetDateWithTime(
        targetDate,
        originalDate,
        timezone
      );

      expect(result.utcDate.getTime()).toBe(result.utcDateTime.toMillis());
      expect(result.utcDate.toISOString()).toBe(result.utcDateTime.toISO());
    });

    describe('Europe/Berlin DST scenarios', () => {
      it('preserves local time across spring forward (CET → CEST)', () => {
        // Before DST: 2024-03-29 08:15 CET
        const originalDate = new Date('2024-03-29T07:15:00.000Z');
        // After DST switch: 2024-04-02
        const targetDate = new Date('2024-04-02');
        const timezone = 'Europe/Berlin';

        const result = combineTargetDateWithTime(
          targetDate,
          originalDate,
          timezone
        );

        // 08:15 local should be preserved
        expect(result.localDateTime.hour).toBe(8);
        expect(result.localDateTime.minute).toBe(15);
        // After DST, offset should be +120 minutes
        expect(result.localDateTime.offset).toBe(120);
      });

      it('preserves local time across fall back (CEST → CET)', () => {
        // After DST: 2024-10-25 08:45 CEST
        const originalDate = new Date('2024-10-25T06:45:00.000Z');
        // Before switch back: 2024-10-20
        const targetDate = new Date('2024-10-20');
        const timezone = 'Europe/Berlin';

        const result = combineTargetDateWithTime(
          targetDate,
          originalDate,
          timezone
        );

        // 08:45 local should be preserved
        expect(result.localDateTime.hour).toBe(8);
        expect(result.localDateTime.minute).toBe(45);
        // Before fall back in October 20, still CEST (+120)
        expect(result.localDateTime.offset).toBe(120);
      });
    });
  });
});
