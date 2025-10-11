import type { FeedingPhase, FeedingTemplate, PhEcReading } from '../types';
import { analyzePerformanceAndGenerateLearnings } from './performance-analysis-service';

describe('performance-analysis-service', () => {
  // Helper to create test readings
  const createReading = ({
    id,
    ph,
    ec25c,
    measuredAt,
  }: {
    id: string;
    ph: number;
    ec25c: number;
    measuredAt: number;
  }): PhEcReading => ({
    id,
    measuredAt,
    ph,
    ecRaw: ec25c,
    ec25c,
    tempC: 25,
    atcOn: true,
    ppmScale: '500',
    createdAt: measuredAt,
    updatedAt: measuredAt,
  });

  const mockPhase: FeedingPhase = {
    phase: 'veg',
    durationDays: 30,
    nutrients: [],
    phRange: [5.8, 6.2],
    ecRange25c: [1.2, 1.6],
  };

  const mockTemplate: FeedingTemplate = {
    id: 'test-template',
    name: 'Test Template',
    medium: 'coco',
    phases: [mockPhase],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('analyzePerformanceAndGenerateLearnings', () => {
    it('should return empty metrics for no readings', () => {
      const result = analyzePerformanceAndGenerateLearnings(
        [],
        mockTemplate,
        mockPhase
      );

      expect(result.metrics.phTimeInBand).toBe(0);
      expect(result.metrics.ecTimeInBand).toBe(0);
      expect(result.suggestions).toHaveLength(0);
      expect(result.improvedTemplate).toBeNull();
    });

    it('should calculate correct time in band percentage', () => {
      const now = Date.now();
      const readings: PhEcReading[] = [
        createReading({ id: '1', ph: 6.0, ec25c: 1.4, measuredAt: now - 4000 }), // In band
        createReading({ id: '2', ph: 6.0, ec25c: 1.4, measuredAt: now - 3000 }), // In band
        createReading({ id: '3', ph: 6.5, ec25c: 1.8, measuredAt: now - 2000 }), // pH high, EC high
        createReading({ id: '4', ph: 5.5, ec25c: 1.0, measuredAt: now - 1000 }), // pH low, EC low
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      // 2 out of 4 readings in band = 50%
      expect(result.metrics.phTimeInBand).toBe(50);
      expect(result.metrics.ecTimeInBand).toBe(50);
    });

    it('should detect rising pH trend and suggest upper range adjustment', () => {
      const now = Date.now();
      // Simulate rising pH trend (all above target)
      const readings: PhEcReading[] = [
        createReading({ id: '1', ph: 6.3, ec25c: 1.4, measuredAt: now - 5000 }),
        createReading({ id: '2', ph: 6.4, ec25c: 1.4, measuredAt: now - 4000 }),
        createReading({ id: '3', ph: 6.5, ec25c: 1.4, measuredAt: now - 3000 }),
        createReading({ id: '4', ph: 6.6, ec25c: 1.4, measuredAt: now - 2000 }),
        createReading({ id: '5', ph: 6.7, ec25c: 1.4, measuredAt: now - 1000 }),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      expect(result.metrics.phTrendDirection).toBe('rising');
      expect(result.suggestions.length).toBeGreaterThan(0);

      const phSuggestion = result.suggestions.find(
        (s) => s.adjustmentType === 'ph_range'
      );
      expect(phSuggestion).toBeDefined();
      expect(phSuggestion?.suggestedPhMax).toBeGreaterThan(
        mockPhase.phRange[1]
      );
      expect(phSuggestion?.confidence).toBe('high');
    });

    it('should detect falling EC trend and suggest lower range adjustment', () => {
      const now = Date.now();
      // Simulate falling EC trend (all below target)
      const readings: PhEcReading[] = [
        createReading({ id: '1', ph: 6.0, ec25c: 1.1, measuredAt: now - 5000 }),
        createReading({ id: '2', ph: 6.0, ec25c: 1.0, measuredAt: now - 4000 }),
        createReading({ id: '3', ph: 6.0, ec25c: 0.9, measuredAt: now - 3000 }),
        createReading({ id: '4', ph: 6.0, ec25c: 0.8, measuredAt: now - 2000 }),
        createReading({ id: '5', ph: 6.0, ec25c: 0.7, measuredAt: now - 1000 }),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      expect(result.metrics.ecTrendDirection).toBe('falling');
      expect(result.suggestions.length).toBeGreaterThan(0);

      const ecSuggestion = result.suggestions.find(
        (s) => s.adjustmentType === 'ec_range'
      );
      expect(ecSuggestion).toBeDefined();
      expect(ecSuggestion?.suggestedEcMin).toBeLessThan(
        mockPhase.ecRange25c[0]
      );
      expect(ecSuggestion?.confidence).toBe('high');
    });

    it('should calculate median correction time correctly', () => {
      const now = Date.now();
      const hourMs = 60 * 60 * 1000;

      // Create pattern: deviation → correction → stable
      const readings: PhEcReading[] = [
        createReading({
          id: '1',
          ph: 6.8,
          ec25c: 1.4,
          measuredAt: now - 10 * hourMs,
        }), // High pH (deviation start)
        createReading({
          id: '2',
          ph: 6.7,
          ec25c: 1.4,
          measuredAt: now - 9 * hourMs,
        }), // Still high
        createReading({
          id: '3',
          ph: 6.0,
          ec25c: 1.4,
          measuredAt: now - 8 * hourMs,
        }), // Corrected (2 hour correction)
        createReading({
          id: '4',
          ph: 6.0,
          ec25c: 1.4,
          measuredAt: now - 7 * hourMs,
        }), // Stable
        createReading({
          id: '5',
          ph: 5.2,
          ec25c: 1.4,
          measuredAt: now - 6 * hourMs,
        }), // Low pH (deviation start)
        createReading({
          id: '6',
          ph: 6.0,
          ec25c: 1.4,
          measuredAt: now - 4 * hourMs,
        }), // Corrected (2 hour correction)
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      // Median of [120 min, 120 min] = 120 min
      expect(result.metrics.medianCorrectionTime).toBe(120);
    });

    it('should not suggest adjustments when performance is good (>70% time in band)', () => {
      const now = Date.now();
      // 8 out of 10 readings in band = 80%
      const readings: PhEcReading[] = [
        createReading('1', 6.0, 1.4, now - 10000),
        createReading('2', 6.0, 1.4, now - 9000),
        createReading('3', 6.0, 1.4, now - 8000),
        createReading('4', 6.0, 1.4, now - 7000),
        createReading('5', 6.0, 1.4, now - 6000),
        createReading('6', 6.0, 1.4, now - 5000),
        createReading('7', 6.0, 1.4, now - 4000),
        createReading('8', 6.0, 1.4, now - 3000),
        createReading('9', 6.5, 1.8, now - 2000), // Out of band
        createReading('10', 5.5, 1.0, now - 1000), // Out of band
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      expect(result.metrics.phTimeInBand).toBe(80);
      expect(result.metrics.ecTimeInBand).toBe(80);
      expect(result.suggestions).toHaveLength(0);
      expect(result.improvedTemplate).toBeNull();
    });

    it('should create improved template with adjusted ranges when suggestions exist', () => {
      const now = Date.now();
      // Poor performance with rising pH trend
      const readings: PhEcReading[] = [
        createReading('1', 6.5, 1.4, now - 5000),
        createReading('2', 6.6, 1.4, now - 4000),
        createReading('3', 6.7, 1.4, now - 3000),
        createReading('4', 6.8, 1.4, now - 2000),
        createReading('5', 6.9, 1.4, now - 1000),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      expect(result.improvedTemplate).not.toBeNull();
      expect(result.improvedTemplate?.name).toContain('(Improved)');
      expect(result.improvedTemplate?.isCustom).toBe(true);

      const improvedPhase = result.improvedTemplate?.phases.find(
        (p) => p.phase === mockPhase.phase
      );
      expect(improvedPhase).toBeDefined();
      expect(improvedPhase?.phRange[1]).toBeGreaterThan(mockPhase.phRange[1]);
    });

    it('should handle unstable fluctuations by widening both range ends', () => {
      const now = Date.now();
      // Fluctuating readings with no clear trend
      const readings: PhEcReading[] = [
        createReading('1', 5.7, 1.4, now - 6000),
        createReading('2', 6.3, 1.4, now - 5000),
        createReading('3', 5.6, 1.4, now - 4000),
        createReading('4', 6.4, 1.4, now - 3000),
        createReading('5', 5.5, 1.4, now - 2000),
        createReading('6', 6.5, 1.4, now - 1000),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      expect(result.metrics.phTrendDirection).toBe('stable');

      const phSuggestion = result.suggestions.find(
        (s) => s.adjustmentType === 'ph_range'
      );
      expect(phSuggestion).toBeDefined();

      // Both min and max should be adjusted for fluctuations
      expect(phSuggestion?.suggestedPhMin).toBeLessThan(mockPhase.phRange[0]);
      expect(phSuggestion?.suggestedPhMax).toBeGreaterThan(
        mockPhase.phRange[1]
      );
      expect(phSuggestion?.confidence).toBe('low');
    });

    it('should respect phase boundaries when suggesting adjustments', () => {
      const now = Date.now();
      // Extreme high pH readings
      const readings: PhEcReading[] = [
        createReading('1', 6.6, 1.4, now - 5000),
        createReading('2', 6.7, 1.4, now - 4000),
        createReading('3', 6.8, 1.4, now - 3000),
        createReading('4', 6.9, 1.4, now - 2000),
        createReading('5', 7.0, 1.4, now - 1000),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        readings,
        mockTemplate,
        mockPhase
      );

      const phSuggestion = result.suggestions.find(
        (s) => s.adjustmentType === 'ph_range'
      );
      expect(phSuggestion).toBeDefined();

      // Should not exceed phase max boundary
      expect(phSuggestion?.suggestedPhMax).toBeLessThanOrEqual(
        mockPhase.phRange[1]
      );
    });

    it('should provide confidence levels based on deviation severity', () => {
      const now = Date.now();

      // Severe deviation (>50% out of band) should give high confidence
      const severeReadings: PhEcReading[] = [
        createReading('1', 6.8, 1.4, now - 10000),
        createReading('2', 6.9, 1.4, now - 9000),
        createReading('3', 7.0, 1.4, now - 8000),
        createReading('4', 7.1, 1.4, now - 7000),
        createReading('5', 7.2, 1.4, now - 6000),
        createReading('6', 7.3, 1.4, now - 5000),
        createReading('7', 7.4, 1.4, now - 4000),
        createReading('8', 7.5, 1.4, now - 3000),
        createReading('9', 6.0, 1.4, now - 2000),
        createReading('10', 6.0, 1.4, now - 1000),
      ];

      const result = analyzePerformanceAndGenerateLearnings(
        severeReadings,
        mockTemplate,
        mockPhase
      );

      const phSuggestion = result.suggestions.find(
        (s) => s.adjustmentType === 'ph_range'
      );
      expect(phSuggestion?.confidence).toBe('high');
    });
  });
});
