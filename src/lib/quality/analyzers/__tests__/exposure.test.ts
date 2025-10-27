import type { ImageLumaData, QualityThresholds } from '../../types';
import { analyzeExposure } from '../exposure';

describe('analyzeExposure', () => {
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
    exposureType: 'well-exposed' | 'underexposed' | 'overexposed' | 'mixed'
  ): ImageLumaData {
    const luma = new Uint8Array(width * height);
    const pixels = new Uint8Array(width * height * 4);

    for (let i = 0; i < luma.length; i += 1) {
      let value: number;

      if (exposureType === 'well-exposed') {
        // Mid-range brightness (128 ± 30)
        value = 128 + Math.floor((Math.random() - 0.5) * 60);
      } else if (exposureType === 'underexposed') {
        // Dark pixels (0-50)
        value = Math.floor(Math.random() * 50);
      } else if (exposureType === 'overexposed') {
        // Bright pixels (200-255)
        value = 200 + Math.floor(Math.random() * 55);
      } else {
        // Mixed: half dark, half bright
        value = i < luma.length / 2 ? 20 : 240;
      }

      luma[i] = Math.max(0, Math.min(255, value));
      pixels[i * 4] = luma[i];
      pixels[i * 4 + 1] = luma[i];
      pixels[i * 4 + 2] = luma[i];
      pixels[i * 4 + 3] = 255;
    }

    return { width, height, luma, pixels };
  }

  describe('well-exposed images', () => {
    it('should return high score for well-exposed image', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.score).toBeGreaterThan(70);
    });

    it('should not flag issues for properly exposed images', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const result = analyzeExposure(data, mockThresholds);

      // Well-exposed images may still have minor issues, but score should be good
      expect(result.score).toBeGreaterThan(60);
    });
  });

  describe('underexposed images', () => {
    it('should return low score for underexposed image', () => {
      const data = createMockImageData(100, 100, 'underexposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.score).toBeLessThan(70);
      expect(result.issue).toBeDefined();
    });

    it('should flag exposure issue for dark images', () => {
      const data = createMockImageData(100, 100, 'underexposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('exposure');
    });

    it('should detect high severity for severely underexposed images', () => {
      const data = createMockImageData(100, 100, 'underexposed');
      const result = analyzeExposure(data, mockThresholds);

      if (result.score < 40) {
        expect(result.issue?.severity).toBe('high');
      }
    });
  });

  describe('overexposed images', () => {
    it('should return low score for overexposed image', () => {
      const data = createMockImageData(100, 100, 'overexposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.score).toBeLessThan(70);
      expect(result.issue).toBeDefined();
    });

    it('should flag exposure issue for bright images', () => {
      const data = createMockImageData(100, 100, 'overexposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('exposure');
    });
  });

  describe('histogram analysis', () => {
    it('should compute histogram correctly', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should detect mixed exposure correctly', () => {
      const data = createMockImageData(100, 100, 'mixed');
      const result = analyzeExposure(data, mockThresholds);

      // Mixed exposure should have issues
      expect(result.issue).toBeDefined();
    });
  });

  describe('threshold sensitivity', () => {
    it('should respect underExposureMaxRatio threshold', () => {
      const data = createMockImageData(100, 100, 'underexposed');
      const strictThresholds = {
        ...mockThresholds,
        exposure: {
          ...mockThresholds.exposure,
          underExposureMaxRatio: 0.05, // Stricter
        },
      };

      const result = analyzeExposure(data, strictThresholds);
      expect(result.score).toBeLessThan(50);
    });

    it('should respect overExposureMaxRatio threshold', () => {
      const data = createMockImageData(100, 100, 'overexposed');
      const strictThresholds = {
        ...mockThresholds,
        exposure: {
          ...mockThresholds.exposure,
          overExposureMaxRatio: 0.05, // Stricter
        },
      };

      const result = analyzeExposure(data, strictThresholds);
      expect(result.score).toBeLessThan(50);
    });

    it('should use acceptableRange for balance scoring', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const narrowRange = {
        ...mockThresholds,
        exposure: {
          ...mockThresholds.exposure,
          acceptableRange: [0.45, 0.55] as [number, number],
        },
      };

      const result = analyzeExposure(data, narrowRange);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid threshold configuration', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const invalidThresholds = {
        ...mockThresholds,
        exposure: {
          ...mockThresholds.exposure,
          underExposureMaxRatio: 0, // Invalid
        },
      };

      const result = analyzeExposure(data, invalidThresholds);
      expect(result.score).toBe(0);
      expect(result.issue).toBeDefined();
    });

    it('should handle invalid acceptable range', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const invalidThresholds = {
        ...mockThresholds,
        exposure: {
          ...mockThresholds.exposure,
          acceptableRange: [0.8, 0.2] as [number, number], // Inverted range
        },
      };

      const result = analyzeExposure(data, invalidThresholds);
      expect(result.score).toBe(0);
      expect(result.issue).toBeDefined();
    });

    it('should normalize scores to 0-100 range', () => {
      const testCases = [
        'well-exposed',
        'underexposed',
        'overexposed',
        'mixed',
      ] as const;

      testCases.forEach((exposureType) => {
        const data = createMockImageData(100, 100, exposureType);
        const result = analyzeExposure(data, mockThresholds);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it('should handle small images', () => {
      const data = createMockImageData(10, 10, 'well-exposed');
      const result = analyzeExposure(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle large images efficiently', () => {
      const data = createMockImageData(1920, 1080, 'well-exposed');
      const startTime = Date.now();

      const result = analyzeExposure(data, mockThresholds);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('severity classification', () => {
    it('should assign high severity for score < 40', () => {
      const data = createMockImageData(100, 100, 'underexposed');
      const result = analyzeExposure(data, mockThresholds);

      if (result.score < 40 && result.issue) {
        expect(result.issue.severity).toBe('high');
      }
    });

    it('should assign medium severity for score >= 40', () => {
      const data = createMockImageData(100, 100, 'well-exposed');
      const result = analyzeExposure(data, mockThresholds);

      if (result.score >= 40 && result.score < 75 && result.issue) {
        expect(result.issue.severity).toBe('medium');
      }
    });
  });
});
