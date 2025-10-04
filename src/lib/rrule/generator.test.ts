/* eslint-disable max-lines-per-function */
import { DateTime } from 'luxon';

import {
  RRULEError,
  RRULEErrorCode,
  RRULEGenerator,
  type TaskTemplate,
  type WeekDay,
} from './generator';

describe('RRULEGenerator', () => {
  let generator: RRULEGenerator;

  beforeEach(() => {
    generator = new RRULEGenerator();
  });

  describe('generateDailyRRULE', () => {
    it('generates daily RRULE with default interval', () => {
      const rrule = generator.generateDailyRRULE();
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=1');
    });

    it('generates daily RRULE with custom interval', () => {
      const rrule = generator.generateDailyRRULE(3);
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=3');
    });
  });

  describe('generateWeeklyRRULE', () => {
    it('generates weekly RRULE with single day', () => {
      const rrule = generator.generateWeeklyRRULE(['monday']);
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO');
    });

    it('generates weekly RRULE with multiple days', () => {
      const rrule = generator.generateWeeklyRRULE(['monday', 'thursday']);
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO,TH');
    });

    it('generates weekly RRULE with custom interval', () => {
      const rrule = generator.generateWeeklyRRULE(['monday'], 2);
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('INTERVAL=2');
      expect(rrule).toContain('BYDAY=MO');
    });

    it('handles different weekday formats', () => {
      const days: WeekDay[] = ['mon', 'TU', 'wednesday'];
      const rrule = generator.generateWeeklyRRULE(days);
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO,TU,WE');
    });

    it('throws error for invalid weekday', () => {
      expect(() => {
        generator.generateWeeklyRRULE(['invalid' as WeekDay]);
      }).toThrow(RRULEError);
    });
  });

  describe('validateRRULEPattern', () => {
    it('validates correct daily RRULE', () => {
      const result = generator.validateRRULEPattern('FREQ=DAILY;INTERVAL=2');
      expect(result.valid).toBe(true);
    });

    it('validates correct weekly RRULE', () => {
      const result = generator.validateRRULEPattern(
        'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH'
      );
      expect(result.valid).toBe(true);
    });

    it('rejects RRULE with both COUNT and UNTIL', () => {
      const result = generator.validateRRULEPattern(
        'FREQ=DAILY;COUNT=5;UNTIL=20250401T000000Z'
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('COUNT and UNTIL');
      }
    });

    it('rejects RRULE with BYDAY and BYMONTHDAY', () => {
      const result = generator.validateRRULEPattern(
        'FREQ=MONTHLY;BYDAY=MO;BYMONTHDAY=15'
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('BYDAY and BYMONTHDAY');
      }
    });

    it('rejects RRULE with invalid interval', () => {
      const result = generator.validateRRULEPattern('FREQ=DAILY;INTERVAL=0');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('INTERVAL');
      }
    });

    it('rejects invalid RRULE syntax', () => {
      const result = generator.validateRRULEPattern('INVALID_RRULE');
      expect(result.valid).toBe(false);
    });
  });

  describe('generateCustomRRULE', () => {
    it('generates RRULE from daily template', () => {
      const template: TaskTemplate = {
        recurrencePattern: 'daily',
        interval: 2,
      };
      const rrule = generator.generateCustomRRULE(
        template,
        'America/Los_Angeles'
      );
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=2');
    });

    it('generates RRULE from weekly template', () => {
      const template: TaskTemplate = {
        recurrencePattern: 'weekly',
        interval: 1,
        weekdays: ['monday', 'wednesday', 'friday'],
      };
      const rrule = generator.generateCustomRRULE(
        template,
        'America/Los_Angeles'
      );
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO,WE,FR');
    });

    it('uses custom RRULE if provided', () => {
      const template: TaskTemplate = {
        customRRule: 'FREQ=DAILY;INTERVAL=3',
      };
      const rrule = generator.generateCustomRRULE(
        template,
        'America/Los_Angeles'
      );
      expect(rrule).toBe('FREQ=DAILY;INTERVAL=3');
    });

    it('throws error for invalid custom RRULE', () => {
      const template: TaskTemplate = {
        customRRule: 'FREQ=DAILY;COUNT=5;UNTIL=20250401T000000Z',
      };
      expect(() => {
        generator.generateCustomRRULE(template, 'America/Los_Angeles');
      }).toThrow(RRULEError);
    });

    it('defaults to daily when no pattern specified', () => {
      const template: TaskTemplate = {};
      const rrule = generator.generateCustomRRULE(
        template,
        'America/Los_Angeles'
      );
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=1');
    });
  });

  describe('nextOccurrence', () => {
    it('computes next daily occurrence', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-28T17:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-28T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next);
        expect(nextDt.toISODate()).toBe('2025-03-29');
      }
    });

    it('computes next weekly occurrence', () => {
      const rrule = 'FREQ=WEEKLY;BYDAY=MO';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-28T10:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-24T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, {
          zone: 'America/Los_Angeles',
        });
        expect(nextDt.weekday).toBe(1);
      }
    });

    it('returns null when no more occurrences', () => {
      const rrule = 'FREQ=DAILY;COUNT=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-29T10:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-28T09:00:00',
      });

      expect(next).toBeNull();
    });

    it('throws error for invalid RRULE', () => {
      expect(() => {
        generator.nextOccurrence('INVALID', {
          after: new Date(),
          timezone: 'America/Los_Angeles',
        });
      }).toThrow(RRULEError);
    });
  });

  describe('DST boundary tests', () => {
    it('handles spring DST transition - UTC time maintained', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-08T17:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-08T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, {
          zone: 'America/Los_Angeles',
        });
        expect(nextDt.toISODate()).toBe('2025-03-09');
        expect(nextDt.hour).toBe(10);
      }
    });

    it('handles fall DST transition - UTC time maintained', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-11-01T16:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-11-01T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, {
          zone: 'America/Los_Angeles',
        });
        expect(nextDt.toISODate()).toBe('2025-11-02');
        expect(nextDt.hour).toBe(8);
      }
    });

    it('handles spring DST transition (Europe/Berlin)', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-29T08:00:00Z'),
        timezone: 'Europe/Berlin',
        dtstartIso: '2025-03-29T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, { zone: 'Europe/Berlin' });
        expect(nextDt.toISODate()).toBe('2025-03-30');
        expect(nextDt.hour).toBe(10);
      }
    });

    it('handles fall DST transition (Europe/Berlin)', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-10-25T07:00:00Z'),
        timezone: 'Europe/Berlin',
        dtstartIso: '2025-10-25T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, { zone: 'Europe/Berlin' });
        expect(nextDt.toISODate()).toBe('2025-10-26');
        expect(nextDt.hour).toBe(8);
      }
    });

    it('handles weekly recurrence across DST boundary', () => {
      const rrule = 'FREQ=WEEKLY;BYDAY=MO';
      const next = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-09T17:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-03T09:00:00',
      });

      expect(next).not.toBeNull();
      if (next) {
        const nextDt = DateTime.fromJSDate(next, {
          zone: 'America/Los_Angeles',
        });
        expect(nextDt.toISODate()).toBe('2025-03-10');
        expect(nextDt.weekday).toBe(1);
        expect(nextDt.hour).toBe(10);
      }
    });

    it('demonstrates DST behavior - UTC time is preserved', () => {
      const rrule = 'FREQ=DAILY;INTERVAL=1';
      const beforeDST = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-08T16:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-08T09:00:00',
      });

      const afterDST = generator.nextOccurrence(rrule, {
        after: new Date('2025-03-09T16:00:00Z'),
        timezone: 'America/Los_Angeles',
        dtstartIso: '2025-03-08T09:00:00',
      });

      if (beforeDST && afterDST) {
        const beforeLocal = DateTime.fromJSDate(beforeDST, {
          zone: 'America/Los_Angeles',
        });
        const afterLocal = DateTime.fromJSDate(afterDST, {
          zone: 'America/Los_Angeles',
        });

        expect(afterDST.getTime() - beforeDST.getTime()).toBe(
          24 * 60 * 60 * 1000
        );
        expect(beforeLocal.hour).toBe(9);
        expect(afterLocal.hour).toBe(10);
      }
    });
  });

  describe('getAnchorDate', () => {
    it('returns phase start date when available', () => {
      const plant = { startDate: new Date('2025-01-01') };
      const phase = { startDate: new Date('2025-02-01') };
      const anchor = generator.getAnchorDate(plant, phase);
      expect(anchor).toEqual(phase.startDate);
    });

    it('returns plant start date when phase not available', () => {
      const plant = { startDate: new Date('2025-01-01') };
      const anchor = generator.getAnchorDate(plant);
      expect(anchor).toEqual(plant.startDate);
    });

    it('returns current date when no dates available', () => {
      const plant = {};
      const before = Date.now();
      const anchor = generator.getAnchorDate(plant);
      const after = Date.now();
      expect(anchor.getTime()).toBeGreaterThanOrEqual(before);
      expect(anchor.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('error handling', () => {
    it('throws RRULEError with correct code for invalid weekday', () => {
      try {
        generator.generateWeeklyRRULE(['invalid' as WeekDay]);
        fail('Should have thrown RRULEError');
      } catch (error) {
        expect(error).toBeInstanceOf(RRULEError);
        expect((error as RRULEError).code).toBe(RRULEErrorCode.INVALID_WEEKDAY);
      }
    });

    it('throws RRULEError with correct code for invalid format', () => {
      const template: TaskTemplate = {
        customRRule: 'FREQ=DAILY;COUNT=5;UNTIL=20250401T000000Z',
      };
      try {
        generator.generateCustomRRULE(template, 'America/Los_Angeles');
        fail('Should have thrown RRULEError');
      } catch (error) {
        expect(error).toBeInstanceOf(RRULEError);
        expect((error as RRULEError).code).toBe(RRULEErrorCode.INVALID_FORMAT);
      }
    });
  });
});
