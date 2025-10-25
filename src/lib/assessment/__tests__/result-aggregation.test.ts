import type { AggregationInput } from '../result-aggregation';
import {
  aggregateResults,
  createMockAggregatedResult,
  getConfidenceLevel,
  shouldShowCommunityCTA,
  validateAggregationInput,
} from '../result-aggregation';

describe('result-aggregation', () => {
  describe('aggregateResults', () => {
    test('aggregates single image result', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.85,
          quality: { score: 90, acceptable: true, issues: [] },
        },
      ];

      const result = aggregateResults(input);

      expect(result.topClass.id).toBe('healthy');
      expect(result.rawConfidence).toBe(0.85);
      expect(result.calibratedConfidence).toBeGreaterThan(0);
      expect(result.perImage).toHaveLength(1);
      expect(result.perImage[0].id).toBe('photo-1');
    });

    test('uses majority vote for multiple images', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: { score: 85, acceptable: true, issues: [] },
        },
        {
          id: 'photo-2',
          uri: 'file:///test2.jpg',
          classId: 'healthy',
          rawConfidence: 0.85,
          quality: { score: 90, acceptable: true, issues: [] },
        },
        {
          id: 'photo-3',
          uri: 'file:///test3.jpg',
          classId: 'nitrogen_deficiency',
          rawConfidence: 0.7,
          quality: { score: 80, acceptable: true, issues: [] },
        },
      ];

      const result = aggregateResults(input);

      expect(result.topClass.id).toBe('healthy');
      expect(result.aggregationMethod).toBe('majority-vote');
      expect(result.perImage).toHaveLength(3);
    });

    test('uses highest confidence for tie', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.75,
          quality: { score: 85, acceptable: true, issues: [] },
        },
        {
          id: 'photo-2',
          uri: 'file:///test2.jpg',
          classId: 'nitrogen_deficiency',
          rawConfidence: 0.9,
          quality: { score: 90, acceptable: true, issues: [] },
        },
      ];

      const result = aggregateResults(input);

      expect(result.topClass.id).toBe('nitrogen_deficiency');
      expect(result.aggregationMethod).toBe('highest-confidence');
    });

    test('returns Unknown/OOD when all predictions below threshold', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.3,
          quality: { score: 85, acceptable: true, issues: [] },
        },
        {
          id: 'photo-2',
          uri: 'file:///test2.jpg',
          classId: 'healthy',
          rawConfidence: 0.35,
          quality: { score: 90, acceptable: true, issues: [] },
        },
      ];

      const result = aggregateResults(input);

      expect(result.topClass.id).toBe('unknown');
      expect(result.topClass.isOod).toBe(true);
      expect(result.isOod).toBe(true);
    });

    test('preserves per-image IDs for correlation', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-abc-123',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: { score: 85, acceptable: true, issues: [] },
        },
        {
          id: 'photo-def-456',
          uri: 'file:///test2.jpg',
          classId: 'healthy',
          rawConfidence: 0.85,
          quality: { score: 90, acceptable: true, issues: [] },
        },
      ];

      const result = aggregateResults(input);

      expect(result.perImage[0].id).toBe('photo-abc-123');
      expect(result.perImage[1].id).toBe('photo-def-456');
    });

    test('throws error for empty results array', () => {
      expect(() => aggregateResults([])).toThrow(
        'Cannot aggregate empty results array'
      );
    });

    test('includes quality scores in per-image results', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: {
            score: 85,
            acceptable: true,
            issues: [
              { type: 'blur', severity: 'low', suggestion: 'Minor blur' },
            ],
          },
        },
      ];

      const result = aggregateResults(input);

      expect(result.perImage[0].quality.score).toBe(85);
      expect(result.perImage[0].quality.issues).toHaveLength(1);
    });
  });

  describe('shouldShowCommunityCTA', () => {
    test('returns true when isOod flag is set', () => {
      const result = createMockAggregatedResult({ isOod: true });
      expect(shouldShowCommunityCTA(result)).toBe(true);
    });

    test('returns true when topClass is marked as OOD', () => {
      const result = createMockAggregatedResult({
        isOod: false,
        topClass: {
          id: 'unknown',
          name: 'Unknown',
          category: 'unknown',
          description: '',
          visualCues: [],
          isOod: true,
          actionTemplate: {
            immediateSteps: [],
            shortTermActions: [],
            diagnosticChecks: [],
            warnings: [],
            disclaimers: [],
          },
          createdAt: Date.now(),
        },
      });
      expect(shouldShowCommunityCTA(result)).toBe(true);
    });

    test('returns false for confident non-OOD result', () => {
      const result = createMockAggregatedResult({
        isOod: false,
        topClass: {
          id: 'healthy',
          name: 'Healthy',
          category: 'healthy',
          description: '',
          visualCues: [],
          isOod: false,
          actionTemplate: {
            immediateSteps: [],
            shortTermActions: [],
            diagnosticChecks: [],
            warnings: [],
            disclaimers: [],
          },
          createdAt: Date.now(),
        },
      });
      expect(shouldShowCommunityCTA(result)).toBe(false);
    });
  });

  describe('getConfidenceLevel', () => {
    test('returns high for confidence >= 0.85', () => {
      expect(getConfidenceLevel(0.85)).toBe('high');
      expect(getConfidenceLevel(0.9)).toBe('high');
      expect(getConfidenceLevel(1.0)).toBe('high');
    });

    test('returns medium for confidence >= 0.7 and < 0.85', () => {
      expect(getConfidenceLevel(0.7)).toBe('medium');
      expect(getConfidenceLevel(0.75)).toBe('medium');
      expect(getConfidenceLevel(0.84)).toBe('medium');
    });

    test('returns low for confidence < 0.7', () => {
      expect(getConfidenceLevel(0.69)).toBe('low');
      expect(getConfidenceLevel(0.5)).toBe('low');
      expect(getConfidenceLevel(0.0)).toBe('low');
    });
  });

  describe('validateAggregationInput', () => {
    test('validates correct input', () => {
      const input: AggregationInput[] = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: { score: 85, acceptable: true, issues: [] },
        },
      ];

      expect(validateAggregationInput(input)).toBe(true);
    });

    test('throws error for empty array', () => {
      expect(() => validateAggregationInput([])).toThrow(
        'Results array cannot be empty'
      );
    });

    test('throws error for missing id', () => {
      const input = [
        {
          id: '',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: { score: 85, acceptable: true, issues: [] },
        },
      ];

      expect(() => validateAggregationInput(input)).toThrow(
        'Each result must have a valid id'
      );
    });

    test('throws error for missing uri', () => {
      const input = [
        {
          id: 'photo-1',
          uri: '',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: { score: 85, acceptable: true, issues: [] },
        },
      ];

      expect(() => validateAggregationInput(input)).toThrow(
        'Each result must have a valid uri'
      );
    });

    test('throws error for invalid rawConfidence', () => {
      const input = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 1.5,
          quality: { score: 85, acceptable: true, issues: [] },
        },
      ];

      expect(() => validateAggregationInput(input)).toThrow(
        'rawConfidence must be a number between 0 and 1'
      );
    });

    test('throws error for missing quality', () => {
      const input = [
        {
          id: 'photo-1',
          uri: 'file:///test1.jpg',
          classId: 'healthy',
          rawConfidence: 0.8,
          quality: {} as any,
        },
      ];

      expect(() => validateAggregationInput(input)).toThrow(
        'Each result must have a valid quality object'
      );
    });
  });

  describe('createMockAggregatedResult', () => {
    test('creates default mock result', () => {
      const result = createMockAggregatedResult();

      expect(result.topClass.id).toBe('unknown');
      expect(result.isOod).toBe(true);
      expect(result.aggregationMethod).toBe('majority-vote');
      expect(result.perImage).toEqual([]);
    });

    test('applies overrides', () => {
      const result = createMockAggregatedResult({
        rawConfidence: 0.9,
        calibratedConfidence: 0.88,
        isOod: false,
      });

      expect(result.rawConfidence).toBe(0.9);
      expect(result.calibratedConfidence).toBe(0.88);
      expect(result.isOod).toBe(false);
    });
  });
});
