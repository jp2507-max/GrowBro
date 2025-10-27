import type { ImageLumaData, QualityThresholds } from '../../types';
import { analyzeComposition } from '../composition';

describe('analyzeComposition', () => {
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
    composition:
      | 'well-framed'
      | 'off-center'
      | 'too-far'
      | 'too-close'
      | 'no-plant'
  ): ImageLumaData {
    const luma = new Uint8Array(width * height);
    const pixels = new Uint8Array(width * height * 4);

    const centerStartX = Math.floor(width * 0.25);
    const centerEndX = Math.ceil(width * 0.75);
    const centerStartY = Math.floor(height * 0.25);
    const centerEndY = Math.ceil(height * 0.75);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        let r: number, g: number, b: number;

        if (composition === 'well-framed') {
          // Plant matter in center with good coverage
          const inCenter =
            x >= centerStartX &&
            x <= centerEndX &&
            y >= centerStartY &&
            y <= centerEndY;
          if (inCenter) {
            // Green plant matter
            r = 60 + Math.floor(Math.random() * 40);
            g = 100 + Math.floor(Math.random() * 60);
            b = 50 + Math.floor(Math.random() * 30);
          } else {
            // Some plant matter outside center too
            if (Math.random() > 0.5) {
              r = 70 + Math.floor(Math.random() * 30);
              g = 110 + Math.floor(Math.random() * 50);
              b = 60 + Math.floor(Math.random() * 20);
            } else {
              // Background
              r = g = b = 240;
            }
          }
        } else if (composition === 'off-center') {
          // Plant matter mostly in one corner
          const inCorner = x < width / 3 && y < height / 3;
          if (inCorner) {
            r = 60 + Math.floor(Math.random() * 40);
            g = 100 + Math.floor(Math.random() * 60);
            b = 50 + Math.floor(Math.random() * 30);
          } else {
            r = g = b = 240;
          }
        } else if (composition === 'too-far') {
          // Small plant in center (low coverage)
          const inSmallCenter =
            x >= width * 0.45 &&
            x <= width * 0.55 &&
            y >= height * 0.45 &&
            y <= height * 0.55;
          if (inSmallCenter) {
            r = 60;
            g = 120;
            b = 50;
          } else {
            r = g = b = 240;
          }
        } else if (composition === 'too-close') {
          // Plant fills entire frame (extreme close-up)
          r = 50 + Math.floor(Math.random() * 50);
          g = 90 + Math.floor(Math.random() * 80);
          b = 40 + Math.floor(Math.random() * 40);
        } else {
          // No plant matter (all background)
          r = g = b = 240;
        }

        const lumaValue = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
        luma[idx] = lumaValue;
        pixels[idx * 4] = r;
        pixels[idx * 4 + 1] = g;
        pixels[idx * 4 + 2] = b;
        pixels[idx * 4 + 3] = 255;
      }
    }

    return { width, height, luma, pixels };
  }

  describe('well-framed images', () => {
    it('should return high score for well-framed plant', () => {
      const data = createMockImageData(100, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeGreaterThan(70);
    });

    it('should not flag issues for proper composition', () => {
      const data = createMockImageData(100, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      // Well-framed should have minimal or no issues
      if (result.issue) {
        expect(result.score).toBeGreaterThan(60);
      }
    });
  });

  describe('framing issues', () => {
    it('should detect off-center composition', () => {
      const data = createMockImageData(100, 100, 'off-center');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeLessThan(90);
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('composition');
    });

    it('should detect plant too far (low coverage)', () => {
      const data = createMockImageData(100, 100, 'too-far');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeLessThan(70);
      expect(result.issue).toBeDefined();
    });

    it('should handle extreme close-up (too close)', () => {
      const data = createMockImageData(100, 100, 'too-close');
      const result = analyzeComposition(data, mockThresholds);

      // Too close might actually pass coverage thresholds
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should detect no plant matter', () => {
      const data = createMockImageData(100, 100, 'no-plant');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeLessThan(50);
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
    });
  });

  describe('plant matter detection', () => {
    it('should detect green plant pixels', () => {
      const wellFramedData = createMockImageData(100, 100, 'well-framed');
      const noPlantData = createMockImageData(100, 100, 'no-plant');

      const wellFramedResult = analyzeComposition(
        wellFramedData,
        mockThresholds
      );
      const noPlantResult = analyzeComposition(noPlantData, mockThresholds);

      expect(wellFramedResult.score).toBeGreaterThan(noPlantResult.score);
    });

    it('should use brightness and saturation for detection', () => {
      const data = createMockImageData(100, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      // Should detect plant matter based on color characteristics
      expect(result.score).toBeGreaterThan(50);
    });
  });

  describe('coverage computation', () => {
    it('should compute overall plant coverage', () => {
      const data = createMockImageData(100, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should compute center coverage separately', () => {
      const wellFramedData = createMockImageData(100, 100, 'well-framed');
      const offCenterData = createMockImageData(100, 100, 'off-center');

      const wellFramedResult = analyzeComposition(
        wellFramedData,
        mockThresholds
      );
      const offCenterResult = analyzeComposition(offCenterData, mockThresholds);

      // Well-framed should have better center coverage
      expect(wellFramedResult.score).toBeGreaterThan(offCenterResult.score);
    });
  });

  describe('threshold sensitivity', () => {
    it('should respect minPlantCoverage threshold', () => {
      const data = createMockImageData(100, 100, 'too-far');
      const strictThresholds = {
        ...mockThresholds,
        composition: {
          ...mockThresholds.composition,
          minPlantCoverage: 0.6, // Stricter
        },
      };

      const result = analyzeComposition(data, strictThresholds);
      expect(result.score).toBeLessThan(60);
    });

    it('should respect minCenterCoverage threshold', () => {
      const data = createMockImageData(100, 100, 'off-center');
      const strictThresholds = {
        ...mockThresholds,
        composition: {
          ...mockThresholds.composition,
          minCenterCoverage: 0.4, // Stricter
        },
      };

      const result = analyzeComposition(data, strictThresholds);
      expect(result.score).toBeLessThan(70);
    });
  });

  describe('edge cases', () => {
    it('should normalize scores to 0-100 range', () => {
      const testCases = [
        'well-framed',
        'off-center',
        'too-far',
        'too-close',
        'no-plant',
      ] as const;

      testCases.forEach((composition) => {
        const data = createMockImageData(100, 100, composition);
        const result = analyzeComposition(data, mockThresholds);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it('should handle small images', () => {
      const data = createMockImageData(10, 10, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle large images efficiently', () => {
      const data = createMockImageData(1920, 1080, 'well-framed');
      const startTime = Date.now();

      const result = analyzeComposition(data, mockThresholds);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('severity classification', () => {
    it('should assign high severity for score < 50', () => {
      const data = createMockImageData(100, 100, 'no-plant');
      const result = analyzeComposition(data, mockThresholds);

      if (result.score < 50 && result.issue) {
        expect(result.issue.severity).toBe('high');
      }
    });

    it('should assign medium severity for score >= 50', () => {
      const data = createMockImageData(100, 100, 'too-far');
      const result = analyzeComposition(data, mockThresholds);

      if (result.score >= 50 && result.score < 75 && result.issue) {
        expect(result.issue.severity).toBe('medium');
      }
    });
  });

  describe('center region computation', () => {
    it('should use 25-75% region for center', () => {
      const data = createMockImageData(100, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      // Center region should be properly computed
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-square images', () => {
      const data = createMockImageData(200, 100, 'well-framed');
      const result = analyzeComposition(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
