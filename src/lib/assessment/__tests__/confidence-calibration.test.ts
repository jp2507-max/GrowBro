import {
  applyTemperatureScaling,
  calibrateConfidence,
  calibrateMultiplePredictions,
  getCalibrationConfig,
  resetCalibrationConfig,
  setCalibrationConfig,
  validateCalibrationConfig,
} from '../confidence-calibration';

describe('confidence-calibration', () => {
  beforeEach(() => {
    resetCalibrationConfig();
  });

  describe('applyTemperatureScaling', () => {
    test('returns 0 for confidence <= 0', () => {
      expect(applyTemperatureScaling(0)).toBe(0);
      expect(applyTemperatureScaling(-0.1)).toBe(0);
    });

    test('returns 1 for confidence >= 1', () => {
      expect(applyTemperatureScaling(1)).toBe(1);
      expect(applyTemperatureScaling(1.1)).toBe(1);
    });

    test('applies temperature scaling correctly', () => {
      // With logit-based scaling: logit(p)/T → sigmoid, T=1.5 reduces confidence
      const raw = 0.8;
      const calibrated = applyTemperatureScaling(raw, 1.5);
      // Logit scaling should reduce confidence for T > 1
      expect(calibrated).toBeLessThan(raw);
      expect(calibrated).toBeGreaterThan(0);
      expect(calibrated).toBeLessThan(1);
    });

    test('temperature = 1 returns unchanged confidence', () => {
      expect(applyTemperatureScaling(0.7, 1)).toBeCloseTo(0.7, 5);
    });

    test('temperature > 1 reduces confidence (softens predictions)', () => {
      const raw = 0.8;
      const calibrated = applyTemperatureScaling(raw, 2);
      expect(calibrated).toBeLessThan(raw);
    });

    test('temperature < 1 increases confidence (sharpens predictions)', () => {
      const raw = 0.6;
      const calibrated = applyTemperatureScaling(raw, 0.5);
      expect(calibrated).toBeGreaterThan(raw);
    });
  });

  describe('calibrateConfidence', () => {
    test('calibrates confidence and applies threshold', () => {
      const result = calibrateConfidence(0.8);
      expect(result.rawConfidence).toBe(0.8);
      expect(result.calibratedConfidence).toBeGreaterThan(0);
      expect(result.threshold).toBe(0.7);
      expect(typeof result.isConfident).toBe('boolean');
    });

    test('uses class-specific threshold when provided', () => {
      const result = calibrateConfidence(0.8, 'healthy');
      expect(result.threshold).toBe(0.75);
      expect(result.classId).toBe('healthy');
    });

    test('marks as confident when above threshold', () => {
      const result = calibrateConfidence(0.9, 'healthy');
      expect(result.isConfident).toBe(true);
    });

    test('marks as not confident when below threshold', () => {
      const result = calibrateConfidence(0.5, 'healthy');
      expect(result.isConfident).toBe(false);
    });
  });

  describe('calibrateMultiplePredictions', () => {
    test('returns empty result for no predictions', () => {
      const result = calibrateMultiplePredictions([]);
      expect(result.rawConfidence).toBe(0);
      expect(result.calibratedConfidence).toBe(0);
      expect(result.isConfident).toBe(false);
      expect(result.perPrediction).toHaveLength(0);
    });

    test('uses majority vote for clear winner', () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.8 },
        { classId: 'healthy', rawConfidence: 0.85 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.7 },
      ];
      const result = calibrateMultiplePredictions(predictions);
      expect(result.classId).toBe('healthy');
      expect(result.aggregationMethod).toBe('majority-vote');
      expect(result.perPrediction).toHaveLength(3);
    });

    test('uses highest confidence for tie', () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.7 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.9 },
      ];
      const result = calibrateMultiplePredictions(predictions);
      expect(result.classId).toBe('nitrogen_deficiency');
      expect(result.aggregationMethod).toBe('highest-confidence');
    });

    test('marks as not confident when all below threshold', () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.3 },
        { classId: 'healthy', rawConfidence: 0.35 },
        { classId: 'healthy', rawConfidence: 0.4 },
      ];
      const result = calibrateMultiplePredictions(predictions);
      expect(result.isConfident).toBe(false);
    });

    test('includes per-prediction calibration results', () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.8 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.7 },
      ];
      const result = calibrateMultiplePredictions(predictions);
      expect(result.perPrediction).toHaveLength(2);
      expect(result.perPrediction[0].rawConfidence).toBe(0.8);
      expect(result.perPrediction[1].rawConfidence).toBe(0.7);
    });
  });

  describe('setCalibrationConfig', () => {
    test('updates calibration configuration', () => {
      setCalibrationConfig({ temperature: 2 });
      const config = getCalibrationConfig();
      expect(config.temperature).toBe(2);
    });

    test('merges class thresholds', () => {
      setCalibrationConfig({
        classThresholds: { healthy: 0.8 },
      });
      const config = getCalibrationConfig();
      expect(config.classThresholds.healthy).toBe(0.8);
      expect(config.classThresholds.nitrogen_deficiency).toBe(0.68);
    });

    test('throws error for invalid configuration', () => {
      expect(() => setCalibrationConfig({ temperature: 0 })).toThrow(
        'Invalid calibration configuration'
      );
    });
  });

  describe('validateCalibrationConfig', () => {
    test('accepts valid configuration', () => {
      expect(
        validateCalibrationConfig({
          temperature: 1.5,
          globalThreshold: 0.7,
        })
      ).toBe(true);
    });

    test('rejects invalid temperature', () => {
      expect(validateCalibrationConfig({ temperature: 0 })).toBe(false);
      expect(validateCalibrationConfig({ temperature: -1 })).toBe(false);
      expect(validateCalibrationConfig({ temperature: 11 })).toBe(false);
    });

    test('rejects invalid global threshold', () => {
      expect(validateCalibrationConfig({ globalThreshold: -0.1 })).toBe(false);
      expect(validateCalibrationConfig({ globalThreshold: 1.1 })).toBe(false);
    });

    test('rejects invalid class thresholds', () => {
      expect(
        validateCalibrationConfig({
          classThresholds: { healthy: -0.1 },
        })
      ).toBe(false);
      expect(
        validateCalibrationConfig({
          classThresholds: { healthy: 1.5 },
        })
      ).toBe(false);
    });
  });

  describe('temperature scaling improves calibration', () => {
    test('softens overconfident predictions', () => {
      // High raw confidence should be reduced with temperature > 1
      const raw = 0.95;
      const calibrated = applyTemperatureScaling(raw, 1.5);
      expect(calibrated).toBeLessThan(raw);
      expect(calibrated).toBeLessThan(1);
    });

    test('maintains reasonable confidence for mid-range predictions', () => {
      const raw = 0.7;
      const calibrated = applyTemperatureScaling(raw, 1.5);
      expect(calibrated).toBeLessThan(raw); // T=1.5 should reduce confidence
      expect(calibrated).toBeGreaterThan(0.5);
    });
  });
});
