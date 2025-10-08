/**
 * LTTB Downsampling Tests
 *
 * Requirements: 4.2, 15.2
 */

import { lttbDownsample, shouldDownsample } from './lttb-downsample';

describe('lttbDownsample', () => {
  describe('Basic Functionality', () => {
    it('should return original data if length <= threshold', () => {
      const data = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 15 },
      ];

      const result = lttbDownsample(data, 5);
      expect(result).toEqual(data);
      expect(result.length).toBe(3);
    });

    it('should return original data if threshold < 3', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));

      const result = lttbDownsample(data, 2);
      expect(result).toEqual(data);
      expect(result.length).toBe(100);
    });

    it('should always include first and last points', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.01) * 100,
      }));

      const result = lttbDownsample(data, 100);

      expect(result[0]).toEqual(data[0]);
      expect(result[result.length - 1]).toEqual(data[data.length - 1]);
    });

    it('should downsample to approximately target length', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));

      const threshold = 365;
      const result = lttbDownsample(data, threshold);

      expect(result.length).toBe(threshold);
    });
  });

  describe('Visual Fidelity', () => {
    it('should preserve peaks in sine wave', () => {
      // Create sine wave with clear peaks
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.02) * 100 + 100,
      }));

      const result = lttbDownsample(data, 100);

      // Find maximum y value in original and downsampled
      const originalMax = Math.max(...data.map((p) => p.y));
      const downsampledMax = Math.max(...result.map((p) => p.y));

      // Downsampled max should be close to original max
      expect(Math.abs(originalMax - downsampledMax)).toBeLessThan(5);
    });

    it('should preserve troughs in sine wave', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.02) * 100 + 100,
      }));

      const result = lttbDownsample(data, 100);

      // Find minimum y value in original and downsampled
      const originalMin = Math.min(...data.map((p) => p.y));
      const downsampledMin = Math.min(...result.map((p) => p.y));

      // Downsampled min should be close to original min
      expect(Math.abs(originalMin - downsampledMin)).toBeLessThan(5);
    });

    it('should maintain monotonic trend', () => {
      // Create strictly increasing data
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: i * 0.5,
      }));

      const result = lttbDownsample(data, 100);

      // Check if downsampled data is also monotonically increasing
      for (let i = 1; i < result.length; i++) {
        expect(result[i].y).toBeGreaterThan(result[i - 1].y);
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should handle 1000+ point datasets (Requirement 15.2)', () => {
      const data = Array.from({ length: 2000 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));

      const threshold = 365;
      const startTime = performance.now();
      const result = lttbDownsample(data, threshold);
      const endTime = performance.now();

      expect(result.length).toBe(threshold);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    it('should handle 365-day datasets efficiently (Requirement 4.2)', () => {
      const data = Array.from({ length: 365 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));

      const threshold = 365;
      const result = lttbDownsample(data, threshold);

      // Should return as-is since length equals threshold
      expect(result).toEqual(data);
      expect(result.length).toBe(365);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const data: { x: number; y: number }[] = [];
      const result = lttbDownsample(data, 100);
      expect(result).toEqual([]);
    });

    it('should handle single point', () => {
      const data = [{ x: 0, y: 10 }];
      const result = lttbDownsample(data, 100);
      expect(result).toEqual(data);
    });

    it('should handle two points', () => {
      const data = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
      ];
      const result = lttbDownsample(data, 100);
      expect(result).toEqual(data);
    });

    it('should handle data with duplicate x values', () => {
      const data = [
        { x: 0, y: 10 },
        { x: 0, y: 20 },
        { x: 1, y: 15 },
        { x: 1, y: 25 },
        { x: 2, y: 30 },
      ];

      const result = lttbDownsample(data, 3);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual(data[0]);
      expect(result[result.length - 1]).toEqual(data[data.length - 1]);
    });

    it('should handle negative values', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.02) * 100, // Oscillates between -100 and 100
      }));

      const result = lttbDownsample(data, 100);
      expect(result.length).toBe(100);

      // Should preserve negative values
      const hasNegative = result.some((p) => p.y < 0);
      expect(hasNegative).toBe(true);
    });
  });

  describe('Generic Type Support', () => {
    it('should work with extended data types', () => {
      interface ExtendedPoint {
        x: number;
        y: number;
        label: string;
        metadata?: string;
      }

      const data: ExtendedPoint[] = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
        label: `Point ${i}`,
        metadata: `Meta ${i}`,
      }));

      const result = lttbDownsample(data, 100);

      expect(result.length).toBe(100);
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('metadata');
    });
  });
});

describe('shouldDownsample', () => {
  it('should return true when data length exceeds threshold', () => {
    expect(shouldDownsample(1000, 365)).toBe(true);
    expect(shouldDownsample(500, 365)).toBe(true);
    expect(shouldDownsample(366, 365)).toBe(true);
  });

  it('should return false when data length is less than or equal to threshold', () => {
    expect(shouldDownsample(365, 365)).toBe(false);
    expect(shouldDownsample(100, 365)).toBe(false);
    expect(shouldDownsample(0, 365)).toBe(false);
  });

  it('should return false when threshold is less than 3', () => {
    expect(shouldDownsample(1000, 2)).toBe(false);
    expect(shouldDownsample(1000, 1)).toBe(false);
    expect(shouldDownsample(1000, 0)).toBe(false);
  });

  it('should use default threshold of 365', () => {
    expect(shouldDownsample(1000)).toBe(true);
    expect(shouldDownsample(365)).toBe(false);
    expect(shouldDownsample(100)).toBe(false);
  });
});
