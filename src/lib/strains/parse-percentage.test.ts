/**
 * Unit tests for parsePercentageRange utility
 */

import { parsePercentageRange } from './normalization';

describe('parsePercentageRange', () => {
  describe('numeric strings', () => {
    test('parses single percentage value', () => {
      expect(parsePercentageRange('17%')).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange('17')).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange('0.5%')).toEqual({ min: 0.5, max: 0.5 });
    });

    test('parses percentage range', () => {
      expect(parsePercentageRange('15-20%')).toEqual({ min: 15, max: 20 });
      expect(parsePercentageRange('15 - 20')).toEqual({ min: 15, max: 20 });
      expect(parsePercentageRange('0.5-1.5%')).toEqual({ min: 0.5, max: 1.5 });
    });
  });

  describe('qualitative values', () => {
    test('returns label for non-numeric strings', () => {
      expect(parsePercentageRange('High')).toEqual({ label: 'High' });
      expect(parsePercentageRange('Low')).toEqual({ label: 'Low' });
      expect(parsePercentageRange('Medium')).toEqual({ label: 'Medium' });
    });
  });

  describe('numeric values', () => {
    test('parses number directly', () => {
      expect(parsePercentageRange(17)).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange(0.5)).toEqual({ min: 0.5, max: 0.5 });
    });
  });

  describe('object values', () => {
    test('parses object with min/max', () => {
      expect(parsePercentageRange({ min: 15, max: 20 })).toEqual({
        min: 15,
        max: 20,
      });
      expect(parsePercentageRange({ min: 15 })).toEqual({ min: 15 });
    });

    test('preserves label in objects', () => {
      expect(parsePercentageRange({ label: 'High' })).toEqual({
        label: 'High',
      });
    });
  });

  describe('edge cases', () => {
    test('handles null and undefined', () => {
      expect(parsePercentageRange(null)).toEqual({});
      expect(parsePercentageRange(undefined)).toEqual({});
    });

    test('handles empty string', () => {
      expect(parsePercentageRange('')).toEqual({ label: '' });
    });

    test('handles malformed strings', () => {
      expect(parsePercentageRange('abc-def')).toEqual({ label: 'abc-def' });
    });
  });
});
