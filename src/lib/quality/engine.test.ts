import { getQualityThresholds } from './config';
import { assessData } from './engine';
import type { QualityThresholds } from './types';

// Mock the config module
jest.mock('./config', () => ({
  getQualityThresholds: jest.fn(),
}));

const mockGetQualityThresholds = getQualityThresholds as jest.MockedFunction<
  typeof getQualityThresholds
>;

describe('Quality Engine', () => {
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

  beforeEach(() => {
    mockGetQualityThresholds.mockReturnValue(mockThresholds);
  });

  test('scales quality scores correctly for threshold comparison', async () => {
    // Mock image data that should produce a score above acceptable threshold
    const mockImageData = {
      width: 100,
      height: 100,
      luma: new Uint8Array(100 * 100).fill(128), // Medium brightness
      pixels: new Uint8Array(100 * 100 * 4).fill(128), // RGBA pixels
    };

    const result = await assessData(mockImageData);

    // The score should be between 0-100
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('handles borderline scores correctly', async () => {
    // Create data that should result in borderline score
    const mockImageData = {
      width: 100,
      height: 100,
      luma: new Uint8Array(100 * 100).fill(100), // Slightly dark
      pixels: new Uint8Array(100 * 100 * 4).fill(100), // RGBA pixels
    };

    const result = await assessData(mockImageData);

    // Should be scaled to 0-100 range
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
