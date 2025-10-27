import type { ImageLumaData, QualityThresholds } from '../../types';
import { analyzeWhiteBalance } from '../white-balance';

describe('analyzeWhiteBalance', () => {
  const mockThresholds: QualityThresholds = {
    blur: {
      minVariance: 100,
      severeVariance: 60,
      weight: 0.35,
    },
    exposure: {
      underExposureMaxRatio: 0.18,
      overExposureMaxRatio: 0.18,
      acceptableRange: [0.25, 0.75],
      weight: 0.25,
    },
    whiteBalance: {
      maxDeviation: 0.15,
      severeDeviation: 0.25,
      weight: 0.2,
    },
    composition: {
      minPlantCoverage: 0.38,
      minCenterCoverage: 0.22,
      weight: 0.2,
    },
    acceptableScore: 75,
    borderlineScore: 60,
  };

  function createMockImageData(
    width: number,
    height: number,
    colorCast: 'neutral' | 'warm' | 'cool' | 'green' | 'severe'
  ): ImageLumaData {
    const luma = new Uint8Array(width * height);
    const pixels = new Uint8Array(width * height * 4);

    for (let i = 0; i < luma.length; i += 1) {
      let r: number, g: number, b: number;

      if (colorCast === 'neutral') {
        // Balanced RGB (neutral gray)
        r = g = b = 128;
      } else if (colorCast === 'warm') {
        // Warm cast (more red/yellow)
        r = 180;
        g = 140;
        b = 100;
      } else if (colorCast === 'cool') {
        // Cool cast (more blue)
        r = 100;
        g = 120;
        b = 180;
      } else if (colorCast === 'green') {
        // Green cast (common with LED grow lights)
        r = 80;
        g = 180;
        b = 90;
      } else {
        // Severe cast (extreme deviation)
        r = 255;
        g = 50;
        b = 50;
      }

      const lumaValue = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
      luma[i] = lumaValue;
      pixels[i * 4] = r;
      pixels[i * 4 + 1] = g;
      pixels[i * 4 + 2] = b;
      pixels[i * 4 + 3] = 255;
    }

    return { width, height, luma, pixels };
  }

  describe('neutral white balance', () => {
    it('should return high score for neutral color balance', () => {
      const data = createMockImageData(100, 100, 'neutral');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeGreaterThan(90);
      expect(result.issue).toBeUndefined();
    });

    it('should not flag issues for balanced images', () => {
      const data = createMockImageData(100, 100, 'neutral');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.issue).toBeUndefined();
    });
  });

  describe('color cast detection', () => {
    it('should detect warm color cast', () => {
      const data = createMockImageData(100, 100, 'warm');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeLessThan(100);
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('white_balance');
    });

    it('should detect cool color cast', () => {
      const data = createMockImageData(100, 100, 'cool');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeLessThan(100);
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('white_balance');
    });

    it('should detect green color cast (LED grow lights)', () => {
      const data = createMockImageData(100, 100, 'green');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeLessThan(90);
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('white_balance');
    });

    it('should detect severe color cast', () => {
      const data = createMockImageData(100, 100, 'severe');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeLessThan(50);
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
    });
  });

  describe('chromaticity deviation computation', () => {
    it('should compute zero deviation for neutral images', () => {
      const data = createMockImageData(100, 100, 'neutral');
      const result = analyzeWhiteBalance(data, mockThresholds);

      // Neutral should have minimal deviation
      expect(result.score).toBeGreaterThan(95);
    });

    it('should compute higher deviation for color casts', () => {
      const neutralData = createMockImageData(100, 100, 'neutral');
      const warmData = createMockImageData(100, 100, 'warm');

      const neutralResult = analyzeWhiteBalance(neutralData, mockThresholds);
      const warmResult = analyzeWhiteBalance(warmData, mockThresholds);

      expect(neutralResult.score).toBeGreaterThan(warmResult.score);
    });
  });

  describe('threshold sensitivity', () => {
    it('should respect maxDeviation threshold', () => {
      const data = createMockImageData(100, 100, 'warm');
      const strictThresholds = {
        ...mockThresholds,
        whiteBalance: {
          ...mockThresholds.whiteBalance,
          maxDeviation: 0.05, // Stricter
        },
      };

      const result = analyzeWhiteBalance(data, strictThresholds);
      expect(result.score).toBeLessThan(70);
    });

    it('should use severeDeviation for severity classification', () => {
      const data = createMockImageData(100, 100, 'severe');
      const result = analyzeWhiteBalance(data, mockThresholds);

      if (result.issue) {
        expect(result.issue.severity).toBe('high');
      }
    });

    it('should assign medium severity for moderate deviations', () => {
      const data = createMockImageData(100, 100, 'warm');
      const result = analyzeWhiteBalance(data, mockThresholds);

      if (result.issue && result.score >= 40) {
        expect(['medium', 'high']).toContain(result.issue.severity);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle invalid pixel buffer (empty)', () => {
      const data: ImageLumaData = {
        width: 100,
        height: 100,
        luma: new Uint8Array(10000),
        pixels: new Uint8Array(0), // Empty pixel buffer
      };

      const result = analyzeWhiteBalance(data, mockThresholds);
      expect(result.score).toBe(0);
      expect(result.issue).toBeDefined();
    });

    it('should handle invalid pixel buffer (not RGBA)', () => {
      const data: ImageLumaData = {
        width: 100,
        height: 100,
        luma: new Uint8Array(10000),
        pixels: new Uint8Array(10001), // Not divisible by 4
      };

      const result = analyzeWhiteBalance(data, mockThresholds);
      expect(result.score).toBe(0);
      expect(result.issue).toBeDefined();
    });

    it('should normalize scores to 0-100 range', () => {
      const testCases = ['neutral', 'warm', 'cool', 'green', 'severe'] as const;

      testCases.forEach((colorCast) => {
        const data = createMockImageData(100, 100, colorCast);
        const result = analyzeWhiteBalance(data, mockThresholds);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it('should handle small images', () => {
      const data = createMockImageData(10, 10, 'neutral');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle large images efficiently', () => {
      const data = createMockImageData(1920, 1080, 'neutral');
      const startTime = Date.now();

      const result = analyzeWhiteBalance(data, mockThresholds);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('severity classification', () => {
    it('should assign high severity for severe deviations', () => {
      const data = createMockImageData(100, 100, 'severe');
      const result = analyzeWhiteBalance(data, mockThresholds);

      if (result.issue) {
        expect(result.issue.severity).toBe('high');
      }
    });

    it('should assign medium severity for moderate deviations', () => {
      const data = createMockImageData(100, 100, 'warm');
      const result = analyzeWhiteBalance(data, mockThresholds);

      if (result.issue && result.score >= 40) {
        expect(['medium', 'high']).toContain(result.issue.severity);
      }
    });
  });

  describe('LED grow light scenarios', () => {
    it('should detect green cast from LED grow lights', () => {
      const data = createMockImageData(100, 100, 'green');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.issue).toBeDefined();
      expect(result.score).toBeLessThan(90);
    });

    it('should handle extreme LED color casts', () => {
      const data = createMockImageData(100, 100, 'severe');
      const result = analyzeWhiteBalance(data, mockThresholds);

      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
      expect(result.score).toBeLessThan(50);
    });
  });
});
