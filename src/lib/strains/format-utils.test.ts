/**
 * Unit tests for format utilities
 */

import { NOT_REPORTED } from './constants';
import { formatFloweringTime, formatYield } from './normalization';

describe('formatFloweringTime', () => {
  test('formats single week value', () => {
    expect(formatFloweringTime({ min_weeks: 8, max_weeks: 8 })).toBe('8 weeks');
  });

  test('formats week range', () => {
    expect(formatFloweringTime({ min_weeks: 8, max_weeks: 10 })).toBe(
      '8-10 weeks'
    );
  });

  test('formats min only', () => {
    expect(formatFloweringTime({ min_weeks: 8 })).toBe('8+ weeks');
  });

  test('formats max only', () => {
    expect(formatFloweringTime({ max_weeks: 10 })).toBe('Up to 10 weeks');
  });

  test('returns default for undefined', () => {
    expect(formatFloweringTime(undefined)).toBe('Varies');
    expect(formatFloweringTime({})).toBe('Varies');
  });
});

describe('formatYield', () => {
  test('formats single value in grams', () => {
    expect(formatYield({ min_grams: 500, max_grams: 500 }, 'grams')).toBe(
      '500g'
    );
  });

  test('formats range in grams', () => {
    expect(formatYield({ min_grams: 400, max_grams: 600 }, 'grams')).toBe(
      '400-600g'
    );
  });

  test('formats min only', () => {
    expect(formatYield({ min_grams: 400 }, 'grams')).toBe('400g+');
  });

  test('formats max only', () => {
    expect(formatYield({ max_grams: 600 }, 'grams')).toBe('Up to 600g');
  });

  test('prioritizes labels', () => {
    expect(formatYield({ min_grams: 500, label: 'High' })).toBe('High');
  });

  test('returns default for undefined', () => {
    expect(formatYield(undefined)).toBe(NOT_REPORTED);
    expect(formatYield({})).toBe(NOT_REPORTED);
  });
});
