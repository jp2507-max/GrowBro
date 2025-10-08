/**
 * Weight Conversion Tests
 */

import {
  formatWeight,
  gramsToOunces,
  ouncesToGrams,
  parseWeightInput,
  toDisplayValue,
  toStorageValue,
  validateDryLessThanWet,
  validateWeight,
} from './weight-conversion';

describe('weight-conversion', () => {
  describe('gramsToOunces', () => {
    test('converts grams to ounces with 1 decimal precision', () => {
      expect(gramsToOunces(28.3495)).toBe(1.0);
      expect(gramsToOunces(100)).toBe(3.5);
      expect(gramsToOunces(0)).toBe(0);
    });

    test('rounds to 1 decimal place', () => {
      expect(gramsToOunces(50)).toBe(1.8);
      expect(gramsToOunces(15)).toBe(0.5);
    });
  });

  describe('ouncesToGrams', () => {
    test('converts ounces to integer grams', () => {
      expect(ouncesToGrams(1.0)).toBe(28);
      expect(ouncesToGrams(3.5)).toBe(99);
      expect(ouncesToGrams(0)).toBe(0);
    });

    test('rounds to nearest integer', () => {
      expect(ouncesToGrams(0.5)).toBe(14);
      expect(ouncesToGrams(1.8)).toBe(51);
    });
  });

  describe('formatWeight', () => {
    test('formats grams with unit', () => {
      expect(formatWeight(100, 'g')).toBe('100 g');
      expect(formatWeight(0, 'g')).toBe('0 g');
      expect(formatWeight(1500, 'g')).toBe('1500 g');
    });

    test('formats ounces with unit and 1 decimal', () => {
      expect(formatWeight(28, 'oz')).toBe('1.0 oz');
      expect(formatWeight(100, 'oz')).toBe('3.5 oz');
      expect(formatWeight(15, 'oz')).toBe('0.5 oz');
    });

    test('defaults to grams', () => {
      expect(formatWeight(100)).toBe('100 g');
    });
  });

  describe('parseWeightInput', () => {
    test('parses valid gram inputs', () => {
      expect(parseWeightInput('100', 'g')).toBe(100);
      expect(parseWeightInput('100.5', 'g')).toBe(101);
      expect(parseWeightInput('0', 'g')).toBe(0);
    });

    test('parses valid ounce inputs and converts to grams', () => {
      expect(parseWeightInput('1', 'oz')).toBe(28);
      expect(parseWeightInput('3.5', 'oz')).toBe(99);
    });

    test('returns null for invalid inputs', () => {
      expect(parseWeightInput('', 'g')).toBeNull();
      expect(parseWeightInput('abc', 'g')).toBeNull();
      expect(parseWeightInput('-10', 'g')).toBeNull();
    });

    test('returns null for weights exceeding max bounds', () => {
      expect(parseWeightInput('100001', 'g')).toBeNull();
      expect(parseWeightInput('4000', 'oz')).toBeNull(); // ~113kg > 100kg
    });

    test('handles whitespace', () => {
      expect(parseWeightInput('  100  ', 'g')).toBe(100);
    });
  });

  describe('validateWeight', () => {
    test('allows null and undefined (optional field)', () => {
      expect(validateWeight(null)).toEqual({ valid: true });
      expect(validateWeight(undefined)).toEqual({ valid: true });
    });

    test('validates non-negative constraint', () => {
      expect(validateWeight(0)).toEqual({ valid: true });
      expect(validateWeight(100)).toEqual({ valid: true });
      expect(validateWeight(-1)).toEqual({
        valid: false,
        error: 'Weight must be non-negative',
      });
    });

    test('validates max weight constraint (≤100,000g)', () => {
      expect(validateWeight(100_000)).toEqual({ valid: true });
      expect(validateWeight(99_999)).toEqual({ valid: true });
      expect(validateWeight(100_001)).toEqual({
        valid: false,
        error: 'Weight must be less than 100000 g',
      });
    });
  });

  describe('validateDryLessThanWet', () => {
    test('allows null/undefined weights', () => {
      expect(validateDryLessThanWet(null, null)).toEqual({ valid: true });
      expect(validateDryLessThanWet(100, null)).toEqual({ valid: true });
      expect(validateDryLessThanWet(null, 50)).toEqual({ valid: true });
      expect(validateDryLessThanWet(undefined, undefined)).toEqual({
        valid: true,
      });
    });

    test('allows dry weight ≤ wet weight', () => {
      expect(validateDryLessThanWet(100, 50)).toEqual({ valid: true });
      expect(validateDryLessThanWet(100, 100)).toEqual({ valid: true });
      expect(validateDryLessThanWet(100, 0)).toEqual({ valid: true });
    });

    test('rejects dry weight > wet weight', () => {
      expect(validateDryLessThanWet(100, 101)).toEqual({
        valid: false,
        error: 'Dry weight cannot exceed wet weight',
      });
      expect(validateDryLessThanWet(50, 100)).toEqual({
        valid: false,
        error: 'Dry weight cannot exceed wet weight',
      });
    });
  });

  describe('toStorageValue', () => {
    test('stores grams as integer', () => {
      expect(toStorageValue(100.7, 'g')).toBe(101);
      expect(toStorageValue(100.2, 'g')).toBe(100);
    });

    test('converts ounces to integer grams for storage', () => {
      expect(toStorageValue(1.0, 'oz')).toBe(28);
      expect(toStorageValue(3.5, 'oz')).toBe(99);
    });
  });

  describe('toDisplayValue', () => {
    test('displays grams as-is', () => {
      expect(toDisplayValue(100, 'g')).toBe(100);
      expect(toDisplayValue(1500, 'g')).toBe(1500);
    });

    test('converts grams to ounces for display', () => {
      expect(toDisplayValue(28, 'oz')).toBe(1.0);
      expect(toDisplayValue(100, 'oz')).toBe(3.5);
    });
  });

  describe('edge cases', () => {
    test('handles zero values', () => {
      expect(gramsToOunces(0)).toBe(0);
      expect(ouncesToGrams(0)).toBe(0);
      expect(parseWeightInput('0', 'g')).toBe(0);
      expect(validateWeight(0)).toEqual({ valid: true });
    });

    test('handles very small values', () => {
      expect(gramsToOunces(0.5)).toBe(0.0);
      expect(ouncesToGrams(0.01)).toBe(0);
      expect(parseWeightInput('0.1', 'g')).toBe(0);
    });

    test('handles boundary values', () => {
      expect(validateWeight(100_000)).toEqual({ valid: true });
      expect(validateWeight(100_001)).toHaveProperty('valid', false);
    });
  });
});
