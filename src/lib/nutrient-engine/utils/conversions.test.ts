/**
 * Unit tests for EC/pH conversion utilities
 */

import type { Calibration, PhEcReading } from '../types';
import { CalibrationType, PpmScale, QualityFlag } from '../types';
import {
  calculateConfidenceScore,
  computeQualityFlags,
  ecToPpm,
  formatEcPpmDisplay,
  formatPpmWithScale,
  toEC25,
} from './conversions';

describe('toEC25', () => {
  describe('temperature compensation', () => {
    it('should return same value at 25°C', () => {
      const result = toEC25(1.5, 25);
      expect(result).toBeCloseTo(1.5, 2);
    });

    it('should increase EC when temperature is below 25°C', () => {
      const result = toEC25(1.5, 20);
      expect(result).toBeGreaterThan(1.5);
      // 1.5 / (1 + 0.02 * (20 - 25)) = 1.5 / 0.9 = 1.6667
      expect(result).toBeCloseTo(1.667, 2);
    });

    it('should decrease EC when temperature is above 25°C', () => {
      const result = toEC25(1.5, 30);
      expect(result).toBeLessThan(1.5);
      expect(result).toBeCloseTo(1.36, 2);
    });

    it('should handle temperature range 15-30°C', () => {
      const temps = [15, 18, 20, 22, 25, 28, 30];
      const ecRaw = 2.0;

      temps.forEach((temp) => {
        const result = toEC25(ecRaw, temp);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(10);
      });
    });

    it('should use custom beta factor', () => {
      const resultDefaultBeta = toEC25(1.5, 20, 0.02);
      const resultCustomBeta = toEC25(1.5, 20, 0.019);

      expect(resultDefaultBeta).not.toBe(resultCustomBeta);
      // 1.5 / (1 + 0.019 * (20 - 25)) = 1.5 / 0.905 = 1.6575
      expect(resultCustomBeta).toBeCloseTo(1.658, 2);
    });
  });

  describe('validation', () => {
    it('should throw error for EC below 0', () => {
      expect(() => toEC25(-0.1, 25)).toThrow(
        'EC reading -0.1 mS/cm is outside valid range 0.00-10.00 mS/cm'
      );
    });

    it('should throw error for EC above 10', () => {
      expect(() => toEC25(10.1, 25)).toThrow(
        'EC reading 10.1 mS/cm is outside valid range 0.00-10.00 mS/cm'
      );
    });

    it('should throw error for temperature below 5°C', () => {
      expect(() => toEC25(1.5, 4)).toThrow(
        'Temperature reading 4°C is outside valid range 5.00-40.00°C'
      );
    });

    it('should throw error for temperature above 40°C', () => {
      expect(() => toEC25(1.5, 41)).toThrow(
        'Temperature reading 41°C is outside valid range 5.00-40.00°C'
      );
    });

    it('should throw error for beta below 0', () => {
      expect(() => toEC25(1.5, 25, -0.01)).toThrow(
        'Temperature coefficient -0.01 is outside valid range 0.00-0.05'
      );
    });

    it('should throw error for beta above 0.05', () => {
      expect(() => toEC25(1.5, 25, 0.06)).toThrow(
        'Temperature coefficient 0.06 is outside valid range 0.00-0.05'
      );
    });

    it('should accept valid boundary values', () => {
      expect(() => toEC25(0, 5)).not.toThrow();
      expect(() => toEC25(10, 40)).not.toThrow();
      expect(() => toEC25(1.5, 25, 0)).not.toThrow();
      expect(() => toEC25(1.5, 25, 0.05)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero EC', () => {
      const result = toEC25(0, 20);
      expect(result).toBe(0);
    });

    it('should handle maximum EC at extreme temperatures', () => {
      // At 5°C, compensation factor = 1 + 0.02 * (5 - 25) = 1 - 0.4 = 0.6
      // 10 / 0.6 = 16.67, which exceeds 10 mS/cm limit
      // This should throw an error as the result is invalid
      expect(() => toEC25(10, 5)).toThrow(
        'Temperature compensation resulted in invalid EC value'
      );
    });
  });
});

describe('ecToPpm', () => {
  describe('500 scale (NaCl/TDS)', () => {
    it('should convert EC to PPM with 500 scale', () => {
      expect(ecToPpm(1.0, '500')).toBe(500);
      expect(ecToPpm(2.0, '500')).toBe(1000);
      expect(ecToPpm(1.5, '500')).toBe(750);
    });

    it('should round to nearest integer', () => {
      expect(ecToPpm(1.234, '500')).toBe(617);
      expect(ecToPpm(1.235, '500')).toBe(618);
    });
  });

  describe('700 scale (442/KCl)', () => {
    it('should convert EC to PPM with 700 scale', () => {
      expect(ecToPpm(1.0, '700')).toBe(700);
      expect(ecToPpm(2.0, '700')).toBe(1400);
      expect(ecToPpm(1.5, '700')).toBe(1050);
    });

    it('should round to nearest integer', () => {
      expect(ecToPpm(1.234, '700')).toBe(864);
      expect(ecToPpm(1.235, '700')).toBe(865);
    });
  });

  describe('validation', () => {
    it('should throw error for negative EC', () => {
      expect(() => ecToPpm(-0.1, '500')).toThrow(
        'EC value -0.1 mS/cm is outside valid range 0.00-10.00 mS/cm'
      );
    });

    it('should throw error for EC above 10', () => {
      expect(() => ecToPpm(10.1, '500')).toThrow(
        'EC value 10.1 mS/cm is outside valid range 0.00-10.00 mS/cm'
      );
    });

    it('should accept boundary values', () => {
      expect(() => ecToPpm(0, '500')).not.toThrow();
      expect(() => ecToPpm(10, '500')).not.toThrow();
    });
  });

  describe('scale comparison', () => {
    it('should produce different values for different scales', () => {
      const ec = 2.0;
      const ppm500 = ecToPpm(ec, '500');
      const ppm700 = ecToPpm(ec, '700');

      expect(ppm700).toBeGreaterThan(ppm500);
      expect(ppm700 / ppm500).toBeCloseTo(1.4, 2);
    });
  });
});

describe('computeQualityFlags', () => {
  const baseReading: PhEcReading = {
    id: 'test-reading',
    measuredAt: Date.now(),
    ph: 6.0,
    ecRaw: 1.5,
    ec25c: 1.5,
    tempC: 22,
    atcOn: true,
    ppmScale: PpmScale.PPM_500,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const validCalibration: Calibration = {
    id: 'test-cal',
    meterId: 'meter-1',
    type: CalibrationType.EC,
    points: [],
    slope: 1.0,
    offset: 0,
    tempC: 25,
    performedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
    expiresAt: Date.now() + 20 * 24 * 60 * 60 * 1000, // 20 days from now
    isValid: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('NO_ATC flag', () => {
    it('should flag when ATC is off', () => {
      const reading = { ...baseReading, atcOn: false };
      const flags = computeQualityFlags(reading);

      expect(flags).toContain(QualityFlag.NO_ATC);
    });

    it('should not flag when ATC is on', () => {
      const reading = { ...baseReading, atcOn: true };
      const flags = computeQualityFlags(reading);

      expect(flags).not.toContain(QualityFlag.NO_ATC);
    });
  });

  describe('CAL_STALE flag', () => {
    it('should flag when calibration is expired', () => {
      const expiredCal = {
        ...validCalibration,
        expiresAt: Date.now() - 1000, // expired 1 second ago
      };
      const flags = computeQualityFlags(baseReading, expiredCal);

      expect(flags).toContain(QualityFlag.CAL_STALE);
    });

    it('should flag when calibration is invalid', () => {
      const invalidCal = { ...validCalibration, isValid: false };
      const flags = computeQualityFlags(baseReading, invalidCal);

      expect(flags).toContain(QualityFlag.CAL_STALE);
    });

    it('should not flag when calibration is valid and not expired', () => {
      const flags = computeQualityFlags(baseReading, validCalibration);

      expect(flags).not.toContain(QualityFlag.CAL_STALE);
    });

    it('should not flag when no calibration provided', () => {
      const flags = computeQualityFlags(baseReading);

      expect(flags).not.toContain(QualityFlag.CAL_STALE);
    });
  });

  describe('TEMP_HIGH flag', () => {
    it('should flag when temperature is 28°C or higher', () => {
      const hotReading = { ...baseReading, tempC: 28 };
      const flags = computeQualityFlags(hotReading);

      expect(flags).toContain(QualityFlag.TEMP_HIGH);
    });

    it('should flag when temperature is above 28°C', () => {
      const hotReading = { ...baseReading, tempC: 30 };
      const flags = computeQualityFlags(hotReading);

      expect(flags).toContain(QualityFlag.TEMP_HIGH);
    });

    it('should not flag when temperature is below 28°C', () => {
      const coolReading = { ...baseReading, tempC: 27.9 };
      const flags = computeQualityFlags(coolReading);

      expect(flags).not.toContain(QualityFlag.TEMP_HIGH);
    });
  });

  describe('multiple flags', () => {
    it('should return multiple flags when multiple issues exist', () => {
      const problematicReading = {
        ...baseReading,
        atcOn: false,
        tempC: 30,
      };
      const expiredCal = {
        ...validCalibration,
        expiresAt: Date.now() - 1000,
      };
      const flags = computeQualityFlags(problematicReading, expiredCal);

      expect(flags).toHaveLength(3);
      expect(flags).toContain(QualityFlag.NO_ATC);
      expect(flags).toContain(QualityFlag.CAL_STALE);
      expect(flags).toContain(QualityFlag.TEMP_HIGH);
    });

    it('should return empty array when no issues exist', () => {
      const perfectReading = { ...baseReading, atcOn: true, tempC: 22 };
      const flags = computeQualityFlags(perfectReading, validCalibration);

      expect(flags).toHaveLength(0);
    });
  });
});

describe('calculateConfidenceScore', () => {
  const baseReading: PhEcReading = {
    id: 'test-reading',
    measuredAt: Date.now(),
    ph: 6.0,
    ecRaw: 1.5,
    ec25c: 1.5,
    tempC: 22,
    atcOn: true,
    ppmScale: PpmScale.PPM_500,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const validCalibration: Calibration = {
    id: 'test-cal',
    meterId: 'meter-1',
    type: CalibrationType.EC,
    points: [],
    slope: 1.0,
    offset: 0,
    tempC: 25,
    performedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() + 20 * 24 * 60 * 60 * 1000,
    isValid: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('should return 1.0 for perfect reading with valid calibration', () => {
    const score = calculateConfidenceScore(baseReading, validCalibration);
    expect(score).toBe(1.0);
  });

  it('should reduce score by 30% for stale calibration', () => {
    const expiredCal = {
      ...validCalibration,
      expiresAt: Date.now() - 1000,
    };
    const score = calculateConfidenceScore(baseReading, expiredCal);
    expect(score).toBeCloseTo(0.7, 2);
  });

  it('should reduce score by 20% for high temperature', () => {
    const hotReading = { ...baseReading, tempC: 30 };
    const score = calculateConfidenceScore(hotReading, validCalibration);
    expect(score).toBeCloseTo(0.8, 2);
  });

  it('should reduce score by 10% for no ATC', () => {
    const noAtcReading = { ...baseReading, atcOn: false };
    const score = calculateConfidenceScore(noAtcReading, validCalibration);
    expect(score).toBeCloseTo(0.9, 2);
  });

  it('should compound multiple factors multiplicatively', () => {
    const problematicReading = {
      ...baseReading,
      atcOn: false,
      tempC: 30,
    };
    const expiredCal = {
      ...validCalibration,
      expiresAt: Date.now() - 1000,
    };
    const score = calculateConfidenceScore(problematicReading, expiredCal);

    // 0.7 (stale cal) × 0.8 (high temp) × 0.9 (no ATC) = 0.504
    expect(score).toBeCloseTo(0.504, 2);
  });

  it('should handle missing calibration', () => {
    const score = calculateConfidenceScore(baseReading);
    expect(score).toBe(1.0);
  });

  it('should clamp score between 0 and 1', () => {
    const score = calculateConfidenceScore(baseReading, validCalibration);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('formatPpmWithScale', () => {
  it('should format PPM with 500 scale', () => {
    const result = formatPpmWithScale(1000, '500');
    expect(result).toBe('1000 ppm [500]');
  });

  it('should format PPM with 700 scale', () => {
    const result = formatPpmWithScale(1400, '700');
    expect(result).toBe('1400 ppm [700]');
  });

  it('should handle zero PPM', () => {
    const result = formatPpmWithScale(0, '500');
    expect(result).toBe('0 ppm [500]');
  });
});

describe('formatEcPpmDisplay', () => {
  it('should format complete display string with 500 scale', () => {
    const result = formatEcPpmDisplay(2.0, '500', 22.4);
    expect(result).toBe('2.0 mS/cm @25°C • 1000 ppm [500] • 22.4°C');
  });

  it('should format complete display string with 700 scale', () => {
    const result = formatEcPpmDisplay(2.0, '700', 22.4);
    expect(result).toBe('2.0 mS/cm @25°C • 1400 ppm [700] • 22.4°C');
  });

  it('should round EC and temperature to 1 decimal place', () => {
    const result = formatEcPpmDisplay(2.345, '500', 22.678);
    expect(result).toContain('2.3 mS/cm');
    expect(result).toContain('22.7°C');
  });

  it('should round PPM to nearest integer', () => {
    const result = formatEcPpmDisplay(1.234, '500', 22);
    expect(result).toContain('617 ppm [500]');
  });
});
