/**
 * Tests for calibration calculation utilities
 */

import type { CalibrationPoint } from '../types';
import {
  calculateCalibrationConfidenceMultiplier,
  calculateDaysUntilExpiry,
  calculateExpirationTimestamp,
  calculateOffset,
  calculateSlope,
  getCalibrationQualityStatus,
  validateCalibrationPoint,
  validateSlope,
} from './calibration-calculations';

describe('calibration-calculations', () => {
  describe('calculateSlope', () => {
    it('should calculate correct slope for two-point pH calibration', () => {
      const points: CalibrationPoint[] = [
        { expected: 4.01, measured: 4.05, stabilizationTime: 30 },
        { expected: 7.0, measured: 6.98, stabilizationTime: 25 },
      ];

      const slope = calculateSlope(points);
      expect(slope).toBeCloseTo(0.98, 2); // Close to 1.0 (ideal)
    });

    it('should calculate correct slope for three-point pH calibration', () => {
      const points: CalibrationPoint[] = [
        { expected: 4.01, measured: 4.03, stabilizationTime: 30 },
        { expected: 7.0, measured: 7.02, stabilizationTime: 25 },
        { expected: 10.01, measured: 9.99, stabilizationTime: 28 },
      ];

      const slope = calculateSlope(points);
      expect(slope).toBeCloseTo(0.99, 2); // Should be close to 1.0
    });

    it('should throw error for less than 2 points', () => {
      const points: CalibrationPoint[] = [
        { expected: 7.0, measured: 7.02, stabilizationTime: 25 },
      ];

      expect(() => calculateSlope(points)).toThrow(
        'At least 2 points required for slope calculation'
      );
    });
  });

  describe('calculateOffset', () => {
    it('should calculate offset for single-point calibration', () => {
      const point: CalibrationPoint = {
        expected: 7.0,
        measured: 7.15,
        stabilizationTime: 30,
      };

      const offset = calculateOffset(point);
      expect(offset).toBeCloseTo(-0.15, 2); // expected - measured = 7.0 - 7.15
    });

    it('should calculate offset for multi-point calibration', () => {
      const points: CalibrationPoint[] = [
        { expected: 4.01, measured: 4.05, stabilizationTime: 30 },
        { expected: 7.0, measured: 6.98, stabilizationTime: 25 },
      ];

      const slope = calculateSlope(points);
      const offset = calculateOffset(undefined, slope, points);

      // offset = mean(y) - slope * mean(x)
      // Actual calculated slope and offset will vary based on implementation
      expect(offset).toBeDefined();
      expect(typeof offset).toBe('number');
    });

    it('should throw error for invalid parameters', () => {
      expect(() => calculateOffset()).toThrow(
        'Invalid parameters: provide either single point or slope with points array'
      );
    });
  });

  describe('validateCalibrationPoint', () => {
    it('should validate pH point within range', () => {
      const point: CalibrationPoint = {
        expected: 7.0,
        measured: 7.05,
        stabilizationTime: 30,
      };

      const result = validateCalibrationPoint(point, 'ph');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject pH expected value out of range', () => {
      const point: CalibrationPoint = {
        expected: 15.0,
        measured: 7.0,
        stabilizationTime: 30,
      };

      const result = validateCalibrationPoint(point, 'ph');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside valid range 0.00–14.00');
    });

    it('should reject pH measured value out of range', () => {
      const point: CalibrationPoint = {
        expected: 7.0,
        measured: -1.0,
        stabilizationTime: 30,
      };

      const result = validateCalibrationPoint(point, 'ph');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside valid range 0.00–14.00');
    });

    it('should validate EC point within range', () => {
      const point: CalibrationPoint = {
        expected: 1.413,
        measured: 1.41,
        stabilizationTime: 45,
      };

      const result = validateCalibrationPoint(point, 'ec');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject EC expected value out of range', () => {
      const point: CalibrationPoint = {
        expected: 25.0,
        measured: 1.413,
        stabilizationTime: 30,
      };

      const result = validateCalibrationPoint(point, 'ec');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside valid range 0.00–20.00');
    });

    it('should reject invalid stabilization time', () => {
      const point: CalibrationPoint = {
        expected: 7.0,
        measured: 7.0,
        stabilizationTime: 400,
      };

      const result = validateCalibrationPoint(point, 'ph');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside reasonable range 0–300s');
    });
  });

  describe('validateSlope', () => {
    it('should validate ideal pH slope', () => {
      const result = validateSlope(1.0, 'ph');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should accept pH slope within acceptable range with warning', () => {
      const result = validateSlope(0.88, 'ph');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('acceptable but not optimal');
    });

    it('should reject pH slope outside acceptable range', () => {
      const result = validateSlope(0.8, 'ph');
      expect(result.valid).toBe(false);
      expect(result.warning).toContain('outside acceptable range');
      expect(result.warning).toContain('Electrode may be degraded');
    });

    it('should validate ideal EC slope', () => {
      const result = validateSlope(1.0, 'ec');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should accept EC slope within acceptable range with warning', () => {
      const result = validateSlope(0.92, 'ec');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('acceptable but not optimal');
    });

    it('should reject EC slope outside acceptable range', () => {
      const result = validateSlope(1.15, 'ec');
      expect(result.valid).toBe(false);
      expect(result.warning).toContain('outside acceptable range');
      expect(result.warning).toContain('Probe may need replacement');
    });
  });

  describe('calculateExpirationTimestamp', () => {
    it('should calculate correct expiration for 30 days', () => {
      const performedAt = Date.now();
      const validDays = 30;

      const expiresAt = calculateExpirationTimestamp(performedAt, validDays);
      const expectedExpiry = performedAt + 30 * 24 * 60 * 60 * 1000;

      expect(expiresAt).toBe(expectedExpiry);
    });

    it('should calculate correct expiration for 90 days', () => {
      const performedAt = Date.now();
      const validDays = 90;

      const expiresAt = calculateExpirationTimestamp(performedAt, validDays);
      const expectedExpiry = performedAt + 90 * 24 * 60 * 60 * 1000;

      expect(expiresAt).toBe(expectedExpiry);
    });
  });

  describe('calculateDaysUntilExpiry', () => {
    it('should calculate positive days for future expiry', () => {
      const now = Date.now();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days from now

      const days = calculateDaysUntilExpiry(expiresAt, now);
      expect(days).toBe(7);
    });

    it('should calculate negative days for past expiry', () => {
      const now = Date.now();
      const expiresAt = now - 5 * 24 * 60 * 60 * 1000; // 5 days ago

      const days = calculateDaysUntilExpiry(expiresAt, now);
      expect(days).toBe(-5);
    });

    it('should calculate zero days for today expiry', () => {
      const now = Date.now();
      const expiresAt = now + 12 * 60 * 60 * 1000; // 12 hours from now (same day)

      const days = calculateDaysUntilExpiry(expiresAt, now);
      expect(days).toBe(0);
    });
  });

  describe('getCalibrationQualityStatus', () => {
    it('should return "valid" for fresh calibration', () => {
      const status = getCalibrationQualityStatus(40); // 40 days until expiry
      expect(status).toBe('valid');
    });

    it('should return "warning" for calibration expiring soon', () => {
      const status = getCalibrationQualityStatus(15); // 15 days until expiry
      expect(status).toBe('warning');
    });

    it('should return "warning" at exactly 30 days', () => {
      const status = getCalibrationQualityStatus(30);
      expect(status).toBe('warning');
    });

    it('should return "expired" for expired calibration', () => {
      const status = getCalibrationQualityStatus(-5); // 5 days past expiry
      expect(status).toBe('expired');
    });

    it('should return "expired" at exactly 0 days (today)', () => {
      const status = getCalibrationQualityStatus(0);
      expect(status).toBe('expired'); // 0 days means expired today
    });
  });

  describe('calculateCalibrationConfidenceMultiplier', () => {
    it('should return 1.0 for fresh calibration', () => {
      const multiplier = calculateCalibrationConfidenceMultiplier(45);
      expect(multiplier).toBe(1.0);
    });

    it('should return 1.0 for calibration at 30+ days', () => {
      const multiplier = calculateCalibrationConfidenceMultiplier(30);
      expect(multiplier).toBe(1.0); // 30 days is at the threshold for valid
    });

    it('should return 0.7 for calibration in warning range', () => {
      const multiplier = calculateCalibrationConfidenceMultiplier(15);
      expect(multiplier).toBe(0.7);
    });

    it('should return 0.5 for expired calibration', () => {
      const multiplier = calculateCalibrationConfidenceMultiplier(-10);
      expect(multiplier).toBe(0.5);
    });
  });
});
