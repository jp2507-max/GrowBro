/**
 * Unit tests for formatPercentageDisplay utility
 */

import { NOT_REPORTED } from './constants';
import { formatPercentageDisplay } from './normalization';

describe('formatPercentageDisplay', () => {
  describe('default locale (en-US)', () => {
    test('prioritizes qualitative labels', () => {
      expect(formatPercentageDisplay({ label: 'High' })).toBe('High');
      expect(formatPercentageDisplay({ min: 15, label: 'High' })).toBe('High');
    });

    test('formats single values', () => {
      expect(formatPercentageDisplay({ min: 17, max: 17 })).toBe('17%');
      expect(formatPercentageDisplay({ min: 0.5, max: 0.5 })).toBe('0.5%');
    });

    test('formats ranges', () => {
      expect(formatPercentageDisplay({ min: 15, max: 20 })).toBe('15-20%');
      expect(formatPercentageDisplay({ min: 0.5, max: 1.5 })).toBe('0.5-1.5%');
    });

    test('formats min only', () => {
      expect(formatPercentageDisplay({ min: 15 })).toBe('15%+');
    });

    test('formats max only', () => {
      expect(formatPercentageDisplay({ max: 20 })).toBe('Up to 20%');
    });

    test('returns NOT_REPORTED for empty ranges', () => {
      expect(formatPercentageDisplay({})).toBe(NOT_REPORTED);
    });
  });

  describe('different locales', () => {
    test('formats with German locale (de-DE)', () => {
      expect(formatPercentageDisplay({ min: 15, max: 20 }, 'de-DE')).toBe(
        '15-20%'
      );
      expect(formatPercentageDisplay({ min: 0.5, max: 1.5 }, 'de-DE')).toBe(
        '0,5-1,5%'
      );
    });

    test('handles unsupported locales gracefully', () => {
      expect(
        formatPercentageDisplay({ min: 15, max: 20 }, 'invalid-locale')
      ).toBe('15-20%');
    });
  });
});
