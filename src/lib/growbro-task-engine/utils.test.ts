import { DateTime } from 'luxon';

import {
  addDays,
  buildDtstartTimestamps,
  buildUntilUtc,
  calculateWaterVolume,
  daysSince,
  getWateringInterval,
  parsePotSizeLiters,
} from './utils';

describe('parsePotSizeLiters', () => {
  it('parses "10L" format', () => {
    expect(parsePotSizeLiters('10L')).toBe(10);
    expect(parsePotSizeLiters('10l')).toBe(10);
    expect(parsePotSizeLiters('10 L')).toBe(10);
  });

  it('parses "10 liter" format', () => {
    expect(parsePotSizeLiters('10 liter')).toBe(10);
    expect(parsePotSizeLiters('10liters')).toBe(10);
  });

  it('parses bare number', () => {
    expect(parsePotSizeLiters('15')).toBe(15);
    expect(parsePotSizeLiters('7.5')).toBe(7.5);
  });

  it('parses gallon notation and converts to liters', () => {
    expect(parsePotSizeLiters('3 gal')).toBe(11); // ~11.35L
    expect(parsePotSizeLiters('5gal')).toBe(19); // ~18.9L
    expect(parsePotSizeLiters('1 gallon')).toBe(4); // ~3.8L
  });

  it('returns default 10L for undefined or invalid input', () => {
    expect(parsePotSizeLiters(undefined)).toBe(10);
    expect(parsePotSizeLiters('')).toBe(10);
    expect(parsePotSizeLiters('medium')).toBe(10);
  });
});

describe('daysSince', () => {
  it('calculates days since a past date', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const start = new Date('2024-06-01T12:00:00Z');
    expect(daysSince(start, now)).toBe(14);
  });

  it('returns 0 for same calendar day (UTC)', () => {
    // Use midday times to avoid timezone edge cases
    const now = new Date('2024-06-15T14:00:00Z');
    const start = new Date('2024-06-15T08:00:00Z');
    expect(daysSince(start, now)).toBe(0);
  });

  it('returns 1 for consecutive calendar days (UTC)', () => {
    // Use midday times to ensure clear day boundary
    const now = new Date('2024-06-15T12:00:00Z');
    const start = new Date('2024-06-14T12:00:00Z');
    expect(daysSince(start, now)).toBe(1);
  });
});

describe('buildDtstartTimestamps', () => {
  it('builds local and UTC timestamps', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      date,
      'Europe/Berlin'
    );

    expect(dtstartLocal).toContain('2024-06-15');
    expect(dtstartUtc).toContain('2024-06-15T10:00:00');
  });

  it('handles different timezones', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const { dtstartLocal } = buildDtstartTimestamps(date, 'America/New_York');

    // 10:00 UTC = 06:00 EDT
    expect(dtstartLocal).toContain('06:00');
  });
});

describe('buildUntilUtc', () => {
  it('returns UTC ISO string', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const until = buildUntilUtc(date);

    expect(until).toContain('2024-06-15T10:00:00');
    expect(until).toContain('Z');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const result = addDays(date, 5);

    expect(DateTime.fromJSDate(result).day).toBe(20);
  });

  it('handles month boundary', () => {
    const date = new Date('2024-06-28T10:00:00Z');
    const result = addDays(date, 5);

    expect(DateTime.fromJSDate(result).month).toBe(7);
    expect(DateTime.fromJSDate(result).day).toBe(3);
  });
});

describe('getWateringInterval', () => {
  it('returns 1 for coco', () => {
    expect(getWateringInterval('coco', 10)).toBe(1);
  });

  it('returns 0 for hydro (no watering tasks)', () => {
    expect(getWateringInterval('hydro', 10)).toBe(0);
  });

  it('returns 2 for small soil pots (<10L)', () => {
    expect(getWateringInterval('soil', 5)).toBe(2);
    expect(getWateringInterval('soil', 9)).toBe(2);
  });

  it('returns 3 for medium soil pots (10-25L)', () => {
    expect(getWateringInterval('soil', 10)).toBe(3);
    expect(getWateringInterval('soil', 15)).toBe(3);
    expect(getWateringInterval('soil', 25)).toBe(3);
  });

  it('returns 4 for large soil pots (>25L)', () => {
    expect(getWateringInterval('soil', 30)).toBe(4);
    expect(getWateringInterval('soil', 50)).toBe(4);
  });

  it('treats living_soil like soil', () => {
    expect(getWateringInterval('living_soil', 5)).toBe(2);
    expect(getWateringInterval('living_soil', 15)).toBe(3);
    expect(getWateringInterval('living_soil', 30)).toBe(4);
  });

  it('treats other medium like soil', () => {
    expect(getWateringInterval('other', 15)).toBe(3);
  });
});

describe('calculateWaterVolume', () => {
  it('calculates 25-30% of pot size for standard pots', () => {
    const { min, max } = calculateWaterVolume(10);
    expect(min).toBe(2.5);
    expect(max).toBe(3);
  });

  it('rounds to 1 decimal place', () => {
    const { min, max } = calculateWaterVolume(7);
    expect(min).toBe(1.8); // 7 * 0.25 = 1.75 → 1.8
    expect(max).toBe(2.1); // 7 * 0.30 = 2.1
  });

  it('handles large pot sizes', () => {
    const { min, max } = calculateWaterVolume(30);
    expect(min).toBe(7.5);
    expect(max).toBe(9);
  });

  it('handles small pot sizes', () => {
    const { min, max } = calculateWaterVolume(3);
    expect(min).toBe(0.8); // 3 * 0.25 = 0.75 → 0.8
    expect(max).toBe(0.9); // 3 * 0.30 = 0.9
  });

  it('throws error for invalid pot sizes', () => {
    expect(() => calculateWaterVolume(0)).toThrow('Invalid pot size: 0');
    expect(() => calculateWaterVolume(-5)).toThrow('Invalid pot size: -5');
    expect(() => calculateWaterVolume(NaN)).toThrow('Invalid pot size: NaN');
    expect(() => calculateWaterVolume(Infinity)).toThrow(
      'Invalid pot size: Infinity'
    );
  });
});
