/**
 * Tests for quality flag utilities
 */

import type { Calibration, PhEcReading } from '../types';
import {
  calculateConfidenceScore,
  calculateQualityFlags,
  getQualityAssessmentMessage,
  getQualityFlagDescription,
  getQualityFlagSeverity,
  hasCriticalQualityIssues,
} from './quality-flags';

describe('quality-flags', () => {
  describe('calculateQualityFlags', () => {
    const baseReading: PhEcReading = {
      id: 'reading-1',
      reservoirId: 'res-1',
      measuredAt: Date.now(),
      ph: 6.0,
      ecRaw: 1.5,
      ec25c: 1.5,
      tempC: 22,
      atcOn: true,
      ppmScale: '500',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should return empty flags for perfect reading', () => {
      const flags = calculateQualityFlags(baseReading, null);
      expect(flags).toEqual([]);
    });

    it('should add NO_ATC flag when ATC is off', () => {
      const reading = { ...baseReading, atcOn: false };
      const flags = calculateQualityFlags(reading, null);

      expect(flags).toContain('NO_ATC');
      expect(flags).toHaveLength(1);
    });

    it('should add TEMP_HIGH flag when temperature >= 28°C', () => {
      const reading = { ...baseReading, tempC: 28 };
      const flags = calculateQualityFlags(reading, null);

      expect(flags).toContain('TEMP_HIGH');
      expect(flags).toHaveLength(1);
    });

    it('should add CAL_STALE flag for warning-range calibration', () => {
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 50 * 24 * 60 * 60 * 1000, // 50 days ago
        expiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000, // expires in 10 days
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const flags = calculateQualityFlags(baseReading, calibration);

      expect(flags).toContain('CAL_STALE');
    });

    it('should add CAL_STALE flag for expired calibration', () => {
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days ago
        expiresAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // expired 10 days ago
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const flags = calculateQualityFlags(baseReading, calibration);

      expect(flags).toContain('CAL_STALE');
    });

    it('should combine multiple flags', () => {
      const reading = { ...baseReading, atcOn: false, tempC: 30 };
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const flags = calculateQualityFlags(reading, calibration);

      expect(flags).toContain('NO_ATC');
      expect(flags).toContain('TEMP_HIGH');
      expect(flags).toContain('CAL_STALE');
      expect(flags).toHaveLength(3);
    });
  });

  describe('calculateConfidenceScore', () => {
    const baseReading: PhEcReading = {
      id: 'reading-1',
      reservoirId: 'res-1',
      measuredAt: Date.now(),
      ph: 6.0,
      ecRaw: 1.5,
      ec25c: 1.5,
      tempC: 22,
      atcOn: true,
      ppmScale: '500',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should return 1.0 for perfect conditions', () => {
      const score = calculateConfidenceScore(baseReading, null);
      expect(score).toBe(1.0);
    });

    it('should reduce score to 0.9 when ATC is off', () => {
      const reading = { ...baseReading, atcOn: false };
      const score = calculateConfidenceScore(reading, null);
      expect(score).toBe(0.9);
    });

    it('should reduce score to 0.8 when temperature is high', () => {
      const reading = { ...baseReading, tempC: 28 };
      const score = calculateConfidenceScore(reading, null);
      expect(score).toBe(0.8);
    });

    it('should reduce score to 0.7 for warning-range calibration', () => {
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000,
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const score = calculateConfidenceScore(baseReading, calibration);
      expect(score).toBe(0.7);
    });

    it('should reduce score to 0.5 for expired calibration', () => {
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const score = calculateConfidenceScore(baseReading, calibration);
      expect(score).toBe(0.5);
    });

    it('should combine multiple factors multiplicatively', () => {
      const reading = { ...baseReading, atcOn: false, tempC: 30 };
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const score = calculateConfidenceScore(reading, calibration);
      // 1.0 * 0.5 (expired) * 0.8 (high temp) * 0.9 (no ATC) = 0.36
      expect(score).toBeCloseTo(0.36, 2);
    });

    it('should never return score below 0', () => {
      const reading = { ...baseReading, atcOn: false, tempC: 35 };
      const calibration: Calibration = {
        id: 'cal-1',
        meterId: 'meter-1',
        type: 'ph',
        points: [],
        slope: 1.0,
        offset: 0,
        tempC: 25,
        performedAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
        isValid: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const score = calculateConfidenceScore(reading, calibration);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('getQualityFlagDescription', () => {
    it('should return description for NO_ATC', () => {
      const desc = getQualityFlagDescription('NO_ATC');
      expect(desc).toContain('automatic temperature compensation');
      expect(desc).toContain('less accurate');
    });

    it('should return description for CAL_STALE', () => {
      const desc = getQualityFlagDescription('CAL_STALE');
      expect(desc).toContain('calibration is stale');
      expect(desc).toContain('recalibrating');
    });

    it('should return description for TEMP_HIGH', () => {
      const desc = getQualityFlagDescription('TEMP_HIGH');
      expect(desc).toContain('28°C');
      expect(desc).toContain('accuracy');
    });

    it('should return description for OUTLIER', () => {
      const desc = getQualityFlagDescription('OUTLIER');
      expect(desc).toContain('differs significantly');
      expect(desc).toContain('recent measurements');
    });
  });

  describe('getQualityFlagSeverity', () => {
    it('should return "info" for NO_ATC', () => {
      expect(getQualityFlagSeverity('NO_ATC')).toBe('info');
    });

    it('should return "warning" for CAL_STALE', () => {
      expect(getQualityFlagSeverity('CAL_STALE')).toBe('warning');
    });

    it('should return "warning" for TEMP_HIGH', () => {
      expect(getQualityFlagSeverity('TEMP_HIGH')).toBe('warning');
    });

    it('should return "warning" for OUTLIER', () => {
      expect(getQualityFlagSeverity('OUTLIER')).toBe('warning');
    });
  });

  describe('hasCriticalQualityIssues', () => {
    it('should return false for no flags', () => {
      expect(hasCriticalQualityIssues([])).toBe(false);
    });

    it('should return false for info/warning flags', () => {
      expect(hasCriticalQualityIssues(['NO_ATC', 'CAL_STALE'])).toBe(false);
    });
  });

  describe('getQualityAssessmentMessage', () => {
    it('should return excellent for perfect conditions', () => {
      const message = getQualityAssessmentMessage(1.0, []);
      expect(message).toContain('Excellent');
    });

    it('should return good for minor issues', () => {
      const message = getQualityAssessmentMessage(0.8, ['NO_ATC']);
      expect(message).toContain('Good');
      expect(message).toContain('minor considerations');
    });

    it('should return fair for moderate issues', () => {
      const message = getQualityAssessmentMessage(0.6, ['CAL_STALE']);
      expect(message).toContain('Fair');
      expect(message).toContain('check calibration');
    });

    it('should return low quality warning for serious issues', () => {
      const message = getQualityAssessmentMessage(0.4, [
        'CAL_STALE',
        'TEMP_HIGH',
      ]);
      expect(message).toContain('Low measurement quality');
      expect(message).toContain('recalibration');
    });
  });
});
