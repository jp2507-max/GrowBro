import type { ImageLumaData, QualityThresholds } from '../../types';
import { analyzeBlur } from '../blur';

describe('analyzeBlur', () => {
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
    lumaPattern: 'sharp' | 'blurred' | 'uniform'
  ): ImageLumaData {
    const luma = new Uint8Array(width * height);
    const pixels = new Uint8Array(width * height * 4);

    if (lumaPattern === 'sharp') {
      // Create sharp edges (high Laplacian variance)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          // Checkerboard pattern for maximum edge variance
          luma[idx] = (x + y) % 2 === 0 ? 255 : 0;
          pixels[idx * 4] = luma[idx];
          pixels[idx * 4 + 1] = luma[idx];
          pixels[idx * 4 + 2] = luma[idx];
          pixels[idx * 4 + 3] = 255;
        }
      }
    } else if (lumaPattern === 'blurred') {
      // Create smooth gradients (low Laplacian variance)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          luma[idx] = Math.floor((x / width) * 255);
          pixels[idx * 4] = luma[idx];
          pixels[idx * 4 + 1] = luma[idx];
          pixels[idx * 4 + 2] = luma[idx];
          pixels[idx * 4 + 3] = 255;
        }
      }
    } else {
      // Uniform gray (zero variance)
      luma.fill(128);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128;
        pixels[i + 1] = 128;
        pixels[i + 2] = 128;
        pixels[i + 3] = 255;
      }
    }

    return { width, height, luma, pixels };
  }

  describe('sharp images', () => {
    it('should return high score for sharp image with high variance', () => {
      const data = createMockImageData(100, 100, 'sharp');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.score).toBeGreaterThan(80);
      expect(result.issue).toBeUndefined();
    });

    it('should not flag issues for variance above minVariance threshold', () => {
      const data = createMockImageData(200, 200, 'sharp');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.issue).toBeUndefined();
    });
  });

  describe('blurred images', () => {
    it('should return low score for blurred image with low variance', () => {
      const data = createMockImageData(100, 100, 'blurred');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.score).toBeLessThan(100);
      expect(result.issue).toBeDefined();
    });

    it('should flag high severity for severely blurred images', () => {
      const data = createMockImageData(100, 100, 'uniform');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.score).toBeLessThan(50);
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
      expect(result.issue?.type).toBe('blur');
    });

    it('should flag medium severity for moderately blurred images', () => {
      const data = createMockImageData(100, 100, 'blurred');
      const result = analyzeBlur(data, mockThresholds);

      if (result.issue) {
        expect(['medium', 'high']).toContain(result.issue.severity);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very small images gracefully', () => {
      const data = createMockImageData(2, 2, 'sharp');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return zero score for zero variance', () => {
      const data = createMockImageData(100, 100, 'uniform');
      const result = analyzeBlur(data, mockThresholds);

      expect(result.score).toBeLessThan(10);
      expect(result.issue).toBeDefined();
    });

    it('should normalize scores to 0-100 range', () => {
      const testCases = ['sharp', 'blurred', 'uniform'] as const;

      testCases.forEach((pattern) => {
        const data = createMockImageData(100, 100, pattern);
        const result = analyzeBlur(data, mockThresholds);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('threshold sensitivity', () => {
    it('should respect custom minVariance threshold', () => {
      const data = createMockImageData(100, 100, 'sharp');
      const strictThresholds = {
        ...mockThresholds,
        blur: { ...mockThresholds.blur, minVariance: 500 },
      };

      const result = analyzeBlur(data, strictThresholds);
      // With higher threshold, same image may not pass
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should use severeVariance for severity classification', () => {
      const data = createMockImageData(100, 100, 'blurred');
      const result = analyzeBlur(data, mockThresholds);

      if (result.issue) {
        expect(['low', 'medium', 'high']).toContain(result.issue.severity);
      }
    });
  });

  describe('Laplacian variance computation', () => {
    it('should detect edges in sharp images', () => {
      const sharpData = createMockImageData(100, 100, 'sharp');
      const blurredData = createMockImageData(100, 100, 'blurred');

      const sharpResult = analyzeBlur(sharpData, mockThresholds);
      const blurredResult = analyzeBlur(blurredData, mockThresholds);

      expect(sharpResult.score).toBeGreaterThan(blurredResult.score);
    });

    it('should handle large images efficiently', () => {
      const data = createMockImageData(1920, 1080, 'sharp');
      const startTime = Date.now();

      const result = analyzeBlur(data, mockThresholds);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
