/**
 * Dosing Calculator Tests
 *
 * Unit tests for EC adjustment and dilution calculations
 */

import {
  calculateDilution,
  calculateEcAdjustment,
  formatDilution,
  formatDosingStep,
} from './dosing-calculator';

describe('calculateEcAdjustment', () => {
  test('calculates stepwise additions correctly', () => {
    const result = calculateEcAdjustment(1.0, 1.5, 10, 0.5);

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.totalMl).toBeGreaterThan(0);
    expect(result.safetyNotes.length).toBeGreaterThan(0);
  });

  test('returns empty steps when already at target', () => {
    const result = calculateEcAdjustment(1.5, 1.5, 10, 0.5);

    expect(result.steps.length).toBe(0);
    expect(result.totalMl).toBe(0);
    expect(result.safetyNotes[0]).toContain('already at or above target');
  });

  test('limits maximum steps to 5', () => {
    const result = calculateEcAdjustment(1.0, 5.0, 10, 0.1, 0.05);

    expect(result.steps.length).toBeLessThanOrEqual(5);
  });

  test('throws error for invalid inputs', () => {
    expect(() => calculateEcAdjustment(-1, 2, 10, 0.5)).toThrow();
    expect(() => calculateEcAdjustment(1, 2, -10, 0.5)).toThrow();
    expect(() => calculateEcAdjustment(1, 2, 10, 0)).toThrow();
  });

  test('warns about large adjustments', () => {
    const result = calculateEcAdjustment(1.0, 3.0, 10, 0.2);

    const hasWarning = result.safetyNotes.some((note) =>
      note.includes('multiple steps')
    );
    expect(hasWarning).toBe(true);
  });
});

describe('calculateDilution', () => {
  test('calculates dilution correctly', () => {
    const result = calculateDilution(2.0, 1.5, 10);

    expect(result.removeL).toBeGreaterThan(0);
    expect(result.addL).toBe(result.removeL);
    expect(result.resultingEc).toBeLessThan(2.0);
    expect(result.safetyNotes.length).toBeGreaterThan(0);
  });

  test('returns zero dilution when already at target', () => {
    const result = calculateDilution(1.5, 1.5, 10);

    expect(result.removeL).toBe(0);
    expect(result.addL).toBe(0);
    expect(result.resultingEc).toBe(1.5);
  });

  test('caps dilution at maximum percentage', () => {
    const result = calculateDilution(5.0, 0.5, 10, 0.2);

    expect(result.removeL).toBeLessThanOrEqual(10 * 0.2);
  });

  test('throws error for invalid inputs', () => {
    expect(() => calculateDilution(0, 1, 10)).toThrow();
    expect(() => calculateDilution(2, -1, 10)).toThrow();
    expect(() => calculateDilution(2, 1, 0)).toThrow();
  });

  test('warns about multiple steps needed', () => {
    const result = calculateDilution(5.0, 0.5, 10, 0.1);

    const hasWarning = result.safetyNotes.some((note) =>
      note.includes('Multiple dilution')
    );
    expect(hasWarning).toBe(true);
  });
});

describe('formatDosingStep', () => {
  test('formats step correctly', () => {
    const formatted = formatDosingStep({
      stepNumber: 1,
      addMl: 10.5,
      resultingEc: 1.25,
    });

    expect(formatted).toContain('Step 1');
    expect(formatted).toContain('10.5 ml');
    expect(formatted).toContain('1.25 mS/cm');
  });
});

describe('formatDilution', () => {
  test('formats dilution correctly', () => {
    const formatted = formatDilution({
      removeL: 2.5,
      addL: 2.5,
      resultingEc: 1.5,
    });

    expect(formatted).toContain('2.5 L');
    expect(formatted).toContain('1.5 mS/cm');
  });
});
