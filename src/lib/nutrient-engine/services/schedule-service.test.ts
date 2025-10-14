import { cleanup } from '@/lib/test-utils';

import { calculateDoseGuidance } from './schedule-service';

afterEach(cleanup);

describe('calculateDoseGuidance', () => {
  describe('Basic functionality', () => {
    test('returns correct structure', () => {
      const nutrients = [{ nutrient: 'A', value: 2.5, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result).toHaveProperty('reservoirVolumeL', 100);
      expect(result).toHaveProperty('nutrientAdditions');
      expect(result).toHaveProperty('safetyNote');
      expect(Array.isArray(result.nutrientAdditions)).toBe(true);
    });

    test('includes safety disclaimer', () => {
      const nutrients = [{ nutrient: 'A', value: 1, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 50);

      expect(result.safetyNote).toContain('Educational guidance only');
      expect(result.safetyNote).toContain('ml/L ratios are auto-calculated');
      expect(result.safetyNote).toContain('measure pH/EC');
    });
  });

  describe('ml/L unit calculations', () => {
    test('calculates correct ml amounts for ml/L ratios', () => {
      const nutrients = [
        { nutrient: 'Nutrient A', value: 2.5, unit: 'ml/L' },
        { nutrient: 'Nutrient B', value: 1.0, unit: 'ml/L' },
      ];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.nutrientAdditions).toHaveLength(2);
      expect(result.nutrientAdditions[0]).toEqual({
        nutrient: 'Nutrient A',
        amountMl: 250,
        stockConcentration: '2.5 ml/L',
      });
      expect(result.nutrientAdditions[1]).toEqual({
        nutrient: 'Nutrient B',
        amountMl: 100,
        stockConcentration: '1 ml/L',
      });
    });

    test('rounds amounts to 1 decimal place', () => {
      const nutrients = [{ nutrient: 'A', value: 1.234, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 50);

      expect(result.nutrientAdditions[0].amountMl).toBe(61.7); // 1.234 * 50 = 61.7
    });

    test('handles zero values', () => {
      const nutrients = [{ nutrient: 'A', value: 0, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.nutrientAdditions[0].amountMl).toBe(0);
    });

    test('handles fractional reservoir volumes', () => {
      const nutrients = [{ nutrient: 'A', value: 2, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 15.5);

      expect(result.nutrientAdditions[0].amountMl).toBe(31); // 2 * 15.5 = 31
    });
  });

  describe('Non-ml/L unit filtering', () => {
    test('filters out ppm units', () => {
      const nutrients = [
        { nutrient: 'A', value: 2.5, unit: 'ml/L' },
        { nutrient: 'B', value: 1500, unit: 'ppm' },
        { nutrient: 'C', value: 1.0, unit: 'ml/L' },
      ];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.nutrientAdditions).toHaveLength(2);
      expect(result.nutrientAdditions.map((a) => a.nutrient)).toEqual([
        'A',
        'C',
      ]);
    });

    test('filters out g/L units', () => {
      const nutrients = [
        { nutrient: 'A', value: 2.5, unit: 'ml/L' },
        { nutrient: 'B', value: 2.0, unit: 'g/L' },
      ];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.nutrientAdditions).toHaveLength(1);
      expect(result.nutrientAdditions[0].nutrient).toBe('A');
    });

    test('handles empty nutrients array', () => {
      const result = calculateDoseGuidance([], 100);

      expect(result.nutrientAdditions).toHaveLength(0);
    });

    test('handles only non-ml/L nutrients', () => {
      const nutrients = [
        { nutrient: 'A', value: 1500, unit: 'ppm' },
        { nutrient: 'B', value: 2.0, unit: 'g/L' },
      ];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.nutrientAdditions).toHaveLength(0);
    });
  });

  describe('Safety note updates', () => {
    test('mentions manual conversion for other units', () => {
      const nutrients = [{ nutrient: 'A', value: 2.5, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 100);

      expect(result.safetyNote).toContain(
        'For other units (ppm, g/L), convert manually'
      );
    });

    test('maintains original safety warnings', () => {
      const nutrients = [{ nutrient: 'A', value: 1, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 50);

      expect(result.safetyNote).toContain('Always start lower');
      expect(result.safetyNote).toContain('measure pH/EC after each addition');
    });
  });

  describe('Edge cases', () => {
    test('handles very small reservoir volumes', () => {
      const nutrients = [{ nutrient: 'A', value: 1, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 0.1);

      expect(result.nutrientAdditions[0].amountMl).toBe(0.1);
    });

    test('handles large reservoir volumes', () => {
      const nutrients = [{ nutrient: 'A', value: 1, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 10000);

      expect(result.nutrientAdditions[0].amountMl).toBe(10000);
    });

    test('preserves reservoir volume in result', () => {
      const nutrients = [{ nutrient: 'A', value: 1, unit: 'ml/L' }];
      const result = calculateDoseGuidance(nutrients, 42.7);

      expect(result.reservoirVolumeL).toBe(42.7);
    });
  });
});
